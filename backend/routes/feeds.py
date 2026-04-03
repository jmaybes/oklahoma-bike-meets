from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel

from database import db
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# ==================== Models ====================

class FeedPostCreate(BaseModel):
    userId: str
    userName: str
    userAvatar: Optional[str] = None
    text: str
    images: List[str] = []  # base64 images, max 4


class FeedPostUpdate(BaseModel):
    text: Optional[str] = None
    images: Optional[List[str]] = None


class CommentCreate(BaseModel):
    userId: str
    userName: str
    text: str


# ==================== Helpers ====================

def feed_post_helper(post) -> dict:
    return {
        "id": str(post["_id"]),
        "userId": post.get("userId", ""),
        "userName": post.get("userName", "Unknown"),
        "userAvatar": post.get("userAvatar"),
        "text": post.get("text", ""),
        "images": post.get("images", []),
        "likes": post.get("likes", 0),
        "likedBy": post.get("likedBy", []),
        "commentCount": post.get("commentCount", 0),
        "createdAt": post.get("createdAt", ""),
        "updatedAt": post.get("updatedAt"),
        "edited": post.get("edited", False),
    }


def comment_helper(comment) -> dict:
    return {
        "id": str(comment["_id"]),
        "postId": comment.get("postId", ""),
        "userId": comment.get("userId", ""),
        "userName": comment.get("userName", "Unknown"),
        "text": comment.get("text", ""),
        "createdAt": comment.get("createdAt", ""),
    }


# ==================== Feed Posts ====================

@router.get("/feeds")
async def get_feed_posts(
    limit: int = Query(default=15, le=50),
    skip: int = Query(default=0, ge=0),
):
    """Get feed posts, newest first. Returns images for display in feed."""
    posts = await db.feed_posts.find().sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    result = []
    for p in posts:
        post_data = feed_post_helper(p)
        # Include image count for UI even if images load lazily
        post_data["imageCount"] = len(post_data.get("images", []))
        result.append(post_data)
    return result


@router.get("/feeds/{post_id}")
async def get_feed_post(post_id: str):
    """Get a single feed post by ID."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")
    
    post = await db.feed_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    return feed_post_helper(post)


@router.post("/feeds")
async def create_feed_post(post: FeedPostCreate):
    """Create a new feed post."""
    if not post.text.strip() and not post.images:
        raise HTTPException(status_code=400, detail="Post must have text or images")

    if len(post.images) > 4:
        raise HTTPException(status_code=400, detail="Maximum 4 images per post")

    # Compress images before storing
    from helpers import compress_photos_list
    compressed_images = compress_photos_list(post.images) if post.images else []

    post_dict = {
        "userId": post.userId,
        "userName": post.userName,
        "userAvatar": post.userAvatar,
        "text": post.text.strip(),
        "images": compressed_images,
        "likes": 0,
        "likedBy": [],
        "commentCount": 0,
        "createdAt": datetime.utcnow().isoformat(),
        "edited": False,
    }

    result = await db.feed_posts.insert_one(post_dict)
    created = await db.feed_posts.find_one({"_id": result.inserted_id})
    return feed_post_helper(created)


@router.put("/feeds/{post_id}")
async def update_feed_post(post_id: str, update: FeedPostUpdate, user_id: str = Query(...)):
    """Edit a feed post (owner only)."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = await db.feed_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own posts")

    update_data = {}
    if update.text is not None:
        update_data["text"] = update.text.strip()
    if update.images is not None:
        if len(update.images) > 4:
            raise HTTPException(status_code=400, detail="Maximum 4 images per post")
        from helpers import compress_photos_list
        update_data["images"] = compress_photos_list(update.images)

    update_data["updatedAt"] = datetime.utcnow().isoformat()
    update_data["edited"] = True

    await db.feed_posts.update_one({"_id": ObjectId(post_id)}, {"$set": update_data})
    updated = await db.feed_posts.find_one({"_id": ObjectId(post_id)})
    return feed_post_helper(updated)


@router.delete("/feeds/{post_id}")
async def delete_feed_post(post_id: str, user_id: str = Query(...)):
    """Delete a feed post and its comments (owner only)."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = await db.feed_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    await db.feed_posts.delete_one({"_id": ObjectId(post_id)})
    await db.feed_comments.delete_many({"postId": post_id})
    return {"status": "deleted"}


# ==================== Likes ====================

@router.post("/feeds/{post_id}/like")
async def toggle_like_post(post_id: str, user_id: str = Query(...)):
    """Toggle like on a feed post."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = await db.feed_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    liked_by = post.get("likedBy", [])

    if user_id in liked_by:
        # Unlike
        await db.feed_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$pull": {"likedBy": user_id}, "$inc": {"likes": -1}}
        )
        return {"liked": False, "likes": post.get("likes", 1) - 1}
    else:
        # Like
        await db.feed_posts.update_one(
            {"_id": ObjectId(post_id)},
            {"$push": {"likedBy": user_id}, "$inc": {"likes": 1}}
        )
        return {"liked": True, "likes": post.get("likes", 0) + 1}


# ==================== Comments ====================

@router.get("/feeds/{post_id}/comments")
async def get_post_comments(
    post_id: str,
    limit: int = Query(default=50, le=200),
):
    """Get comments for a feed post."""
    comments = await db.feed_comments.find(
        {"postId": post_id}
    ).sort("createdAt", 1).limit(limit).to_list(limit)
    return [comment_helper(c) for c in comments]


@router.post("/feeds/{post_id}/comments")
async def add_comment(post_id: str, comment: CommentCreate):
    """Add a comment to a feed post."""
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = await db.feed_posts.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if not comment.text.strip():
        raise HTTPException(status_code=400, detail="Comment cannot be empty")

    comment_dict = {
        "postId": post_id,
        "userId": comment.userId,
        "userName": comment.userName,
        "text": comment.text.strip(),
        "createdAt": datetime.utcnow().isoformat(),
    }

    result = await db.feed_comments.insert_one(comment_dict)
    await db.feed_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"commentCount": 1}}
    )

    created = await db.feed_comments.find_one({"_id": result.inserted_id})
    return comment_helper(created)


@router.delete("/feeds/{post_id}/comments/{comment_id}")
async def delete_comment(post_id: str, comment_id: str, user_id: str = Query(...)):
    """Delete a comment (comment owner only)."""
    if not ObjectId.is_valid(comment_id):
        raise HTTPException(status_code=400, detail="Invalid comment ID")

    comment = await db.feed_comments.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment["userId"] != user_id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    await db.feed_comments.delete_one({"_id": ObjectId(comment_id)})
    await db.feed_posts.update_one(
        {"_id": ObjectId(post_id)},
        {"$inc": {"commentCount": -1}}
    )
    return {"status": "deleted"}
