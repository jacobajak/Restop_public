/**
 * Operating Hours Settings
 * 
 * Configure when the restaurant accepts orders
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button, Card, Checkbox, Input } from '@/components/common';
import { useToast } from '@/components/common';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

interface DaySchedule {
  day: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export const OperatingHoursSettings: React.FC = () => {
  const { success } = useToast();
  const [loading, setLoading] = useState(false);
  const [schedule, setSchedule] = useState<DaySchedule[]>([
    { day: 'Monday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
    { day: 'Tuesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
    { day: 'Wednesday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
    { day: 'Thursday', isOpen: true, openTime: '08:00', closeTime: '22:00' },
    { day: 'Friday', isOpen: true, openTime: '08:00', closeTime: '23:00' },
    { day: 'Saturday', isOpen: true, openTime: '09:00', closeTime: '23:00' },
    { day: 'Sunday', isOpen: false, openTime: '08:00', closeTime: '22:00' },
  ]);

  const handleDayToggle = (index: number) => {
    setSchedule(prev => {
      const updated = [...prev];
      updated[index].isOpen = !updated[index].isOpen;
      return updated;
    });
  };

  const handleTimeChange = (
    index: number,
    field: 'openTime' | 'closeTime',
    value: string
  ) => {
    setSchedule(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Save to backend
      // await axios.put('/api/v1/tenants/operating-hours', { schedule });
      success('Operating hours updated successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-pageTitle font-bold text-neutral-900 dark:text-dark-text">
          🕐 Operating Hours
        </h1>
        <p className="text-body text-neutral-600 dark:text-neutral-400 mt-2">
          Set the hours when your restaurant accepts orders. Customers cannot
          place orders when you&apos;re closed.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-4">
            <h2 className="text-sectionTitle font-semibold text-neutral-900 dark:text-dark-text mb-6">
              Weekly Schedule
            </h2>

            {schedule.map((day, index) => (
              <div
                key={day.day}
                className="flex items-center gap-4 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
              >
                <Checkbox
                  checked={day.isOpen}
                  onChange={() => handleDayToggle(index)}
                />

                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 min-w-24">
                    {day.day}
                  </p>
                </div>

                {day.isOpen ? (
                  <div className="flex items-center gap-3">
                    <Input
                      type="time"
                      value={day.openTime}
                      onChange={e => handleTimeChange(index, 'openTime', e.target.value)}
                      className="w-24"
                    />
                    <span className="text-neutral-500">—</span>
                    <Input
                      type="time"
                      value={day.closeTime}
                      onChange={e => handleTimeChange(index, 'closeTime', e.target.value)}
                      className="w-24"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                    Closed
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card className="mt-6 bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <div className="text-xl">ℹ️</div>
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Temporary Pause
              </p>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                To temporarily pause orders when the kitchen is busy, you can
                enable &quot;Pause Orders&quot; in Order Settings.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex gap-3 justify-end mt-6">
          <Button variant="secondary" type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" isLoading={loading}>
            Save Schedule
          </Button>
        </div>
      </form>
    </div>
  );
};

export default OperatingHoursSettings;
