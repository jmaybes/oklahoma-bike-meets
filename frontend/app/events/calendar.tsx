import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import axios from 'axios';

import { API_URL } from '../../utils/api';

interface Event {
  id: string;
  title: string;
  date: string;
  time?: string;
  location?: string;
  eventType?: string;
  cost?: string;
  imageUrl?: string;
  isRecurring?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const eventTypeColors: { [key: string]: string } = {
  'Bike Meet': '#51fb00',
  'Bike Show': '#FFC107',
  'Group Ride': '#4FC3F7',
  'Pop Up': '#E91E63',
  'Swap Meet': '#9C27B0',
  'Track Day': '#FF9800',
  'Rally': '#F44336',
  'Other': '#666',
};

function formatEventDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const [year, month, day] = clean.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

export default function CalendarViewScreen() {
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/events`);
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Build a map of date -> event count
  const eventsByDate = useMemo(() => {
    const map: { [key: string]: Event[] } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    events.forEach((event) => {
      if (!event.date) return;
      const clean = event.date.split('T')[0];
      const [y, m, d] = clean.split('-').map(Number);
      const eventDate = new Date(y, m - 1, d);
      if (eventDate >= today) {
        if (!map[clean]) map[clean] = [];
        map[clean].push(event);
      }
    });
    return map;
  }, [events]);

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const days: { date: Date | null; dateStr: string; isToday: boolean; isPast: boolean; eventCount: number }[] = [];

    // Padding for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: null, dateStr: '', isToday: false, isPast: false, eventCount: 0 });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = date.getTime() === today.getTime();
      const isPast = date < today;
      const eventCount = eventsByDate[dateStr]?.length || 0;
      days.push({ date, dateStr, isToday, isPast, eventCount });
    }

    return days;
  }, [currentMonth, eventsByDate]);

  // Events for selected date
  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    return eventsByDate[selectedDate] || [];
  }, [selectedDate, eventsByDate]);

  const goToPrevMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    setCurrentMonth(prev);
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    const next = new Date(currentMonth);
    next.setMonth(next.getMonth() + 1);
    setCurrentMonth(next);
    setSelectedDate(null);
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    setSelectedDate(dateStr);
  };

  const renderEventCard = ({ item }: { item: Event }) => {
    const typeColor = eventTypeColors[item.eventType || 'Other'] || '#666';
    return (
      <TouchableOpacity
        style={styles.eventCard}
        onPress={() => router.push(`/event/${item.id}`)}
        activeOpacity={0.7}
      >
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.eventImage} resizeMode="cover" />
        ) : (
          <View style={[styles.eventImagePlaceholder, { backgroundColor: typeColor + '20' }]}>
            <Ionicons name="bicycle" size={24} color={typeColor} />
          </View>
        )}
        <View style={styles.eventCardContent}>
          <View style={styles.eventCardHeader}>
            <View style={[styles.eventTypeBadge, { backgroundColor: typeColor + '25', borderColor: typeColor }]}>
              <Text style={[styles.eventTypeBadgeText, { color: typeColor }]}>{item.eventType || 'Event'}</Text>
            </View>
            {item.isRecurring && (
              <View style={styles.recurringBadge}>
                <Ionicons name="repeat" size={10} color="#4FC3F7" />
              </View>
            )}
          </View>
          <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.eventMeta}>
            <Ionicons name="time-outline" size={13} color="#888" />
            <Text style={styles.eventMetaText}>{item.time || 'TBD'}</Text>
          </View>
          {item.location && (
            <View style={styles.eventMeta}>
              <Ionicons name="location-outline" size={13} color="#888" />
              <Text style={styles.eventMetaText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}
          {item.cost && item.cost !== 'Free' && item.cost !== '0' && (
            <View style={styles.eventMeta}>
              <Ionicons name="pricetag-outline" size={13} color="#888" />
              <Text style={styles.eventMetaText}>{item.cost}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#51fb00" />
          <Text style={styles.loadingText}>Loading calendar...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar View</Text>
        <TouchableOpacity onPress={goToToday} style={styles.todayButton}>
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-back" size={24} color="#51fb00" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.monthArrow}>
            <Ionicons name="chevron-forward" size={24} color="#51fb00" />
          </TouchableOpacity>
        </View>

        {/* Weekday Headers */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((day) => (
            <View key={day} style={styles.weekdayCell}>
              <Text style={styles.weekdayText}>{day}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((day, index) => {
            if (!day.date) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }
            const isSelected = day.dateStr === selectedDate;
            const hasEvents = day.eventCount > 0;

            return (
              <TouchableOpacity
                key={day.dateStr}
                style={[
                  styles.dayCell,
                  day.isToday && styles.dayCellToday,
                  isSelected && styles.dayCellSelected,
                  day.isPast && styles.dayCellPast,
                ]}
                onPress={() => {
                  if (hasEvents) {
                    setSelectedDate(isSelected ? null : day.dateStr);
                  }
                }}
                activeOpacity={hasEvents ? 0.6 : 1}
              >
                <Text style={[
                  styles.dayNumber,
                  day.isToday && styles.dayNumberToday,
                  isSelected && styles.dayNumberSelected,
                  day.isPast && styles.dayNumberPast,
                ]}>
                  {day.date.getDate()}
                </Text>
                {hasEvents && (
                  <View style={[
                    styles.eventDot,
                    isSelected && styles.eventDotSelected,
                    day.eventCount > 1 && styles.eventDotMultiple,
                  ]}>
                    <Text style={[
                      styles.eventDotText,
                      isSelected && styles.eventDotTextSelected,
                    ]}>
                      {day.eventCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Date Events */}
        {selectedDate && (
          <View style={styles.selectedSection}>
            <LinearGradient
              colors={['#1a1a1a', '#111']}
              style={styles.selectedHeader}
            >
              <Text style={styles.selectedHeaderText}>
                {formatEventDate(selectedDate)}
              </Text>
              <View style={styles.selectedCountBadge}>
                <Text style={styles.selectedCountText}>
                  {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </LinearGradient>

            {selectedEvents.map((event) => (
              <View key={event.id}>
                {renderEventCard({ item: event })}
              </View>
            ))}
          </View>
        )}

        {/* No date selected hint */}
        {!selectedDate && (
          <View style={styles.hintContainer}>
            <Ionicons name="hand-left-outline" size={24} color="#555" />
            <Text style={styles.hintText}>Tap a date with events to view them</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  todayButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 85, 0, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#51fb00',
  },
  todayButtonText: {
    color: '#51fb00',
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  monthArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  monthTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  weekdayText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayCellToday: {
    backgroundColor: 'rgba(255, 85, 0, 0.1)',
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: '#51fb00',
    borderRadius: 12,
  },
  dayCellPast: {
    opacity: 0.35,
  },
  dayNumber: {
    color: '#ddd',
    fontSize: 15,
    fontWeight: '500',
  },
  dayNumberToday: {
    color: '#51fb00',
    fontWeight: '800',
  },
  dayNumberSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  dayNumberPast: {
    color: '#555',
  },
  eventDot: {
    marginTop: 2,
    backgroundColor: 'rgba(255, 85, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  eventDotSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  eventDotMultiple: {
    backgroundColor: 'rgba(255, 85, 0, 0.35)',
  },
  eventDotText: {
    color: '#51fb00',
    fontSize: 10,
    fontWeight: '700',
  },
  eventDotTextSelected: {
    color: '#fff',
  },
  selectedSection: {
    marginTop: 16,
    marginHorizontal: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  selectedHeaderText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  selectedCountBadge: {
    backgroundColor: 'rgba(255, 85, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedCountText: {
    color: '#51fb00',
    fontSize: 12,
    fontWeight: '700',
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#252525',
  },
  eventImage: {
    width: 90,
    height: '100%',
    minHeight: 100,
  },
  eventImagePlaceholder: {
    width: 90,
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventCardContent: {
    flex: 1,
    padding: 12,
    gap: 4,
  },
  eventCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  eventTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  eventTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recurringBadge: {
    backgroundColor: 'rgba(79, 195, 247, 0.15)',
    borderRadius: 10,
    padding: 3,
  },
  eventTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eventMetaText: {
    color: '#888',
    fontSize: 12,
    flex: 1,
  },
  hintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  hintText: {
    color: '#555',
    fontSize: 14,
  },
});
