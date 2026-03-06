'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface Props {
  stats: Record<string, unknown> | null;
}

export function AnalyticsPanel({ stats }: Props) {
  if (!stats) {
    return (
      <div className="text-center py-20">
        <BarChart3 className="w-16 h-16 text-white/20 mx-auto mb-4" />
        <p className="text-white/40">No analytics data yet</p>
      </div>
    );
  }

  const dailyStats = (stats.dailyStats as { date: string; photos: number; gifs: number; ai: number }[]) || [];
  const eventStats = (stats.eventStats as { id: string; name: string; photoCount: number; shareCount: number; aiCount: number }[]) || [];

  return (
    <div className="space-y-8">
      {/* Daily activity chart */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-6">📈 Daily Activity (Last 30 Days)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyStats}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }}
              tickFormatter={(d) => d.slice(5)} // Show MM-DD
            />
            <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
              labelStyle={{ color: 'white' }}
              itemStyle={{ color: 'rgba(255,255,255,0.7)' }}
            />
            <Line type="monotone" dataKey="photos" stroke="#60a5fa" strokeWidth={2} dot={false} name="Photos" />
            <Line type="monotone" dataKey="gifs" stroke="#fbbf24" strokeWidth={2} dot={false} name="GIFs" />
            <Line type="monotone" dataKey="ai" stroke="#a78bfa" strokeWidth={2} dot={false} name="AI" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Per event breakdown */}
      {eventStats.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h3 className="text-white font-semibold mb-6">📅 Per Event Breakdown</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={eventStats.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                tickFormatter={(n) => n.length > 15 ? n.slice(0, 15) + '…' : n}
              />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                labelStyle={{ color: 'white' }}
              />
              <Bar dataKey="photoCount" fill="#60a5fa" name="Photos" radius={4} />
              <Bar dataKey="shareCount" fill="#34d399" name="Shares" radius={4} />
              <Bar dataKey="aiCount" fill="#a78bfa" name="AI" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Event table */}
      {eventStats.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold">📊 Event Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  {['Event', 'Photos', 'Shares', 'AI Used', 'Prints'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-white/40 text-sm font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {eventStats.map((event, i) => (
                  <tr key={event.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                    <td className="px-6 py-4 text-white font-medium">{event.name}</td>
                    <td className="px-6 py-4 text-white/60">{event.photoCount}</td>
                    <td className="px-6 py-4 text-white/60">{event.shareCount}</td>
                    <td className="px-6 py-4 text-white/60">{event.aiCount}</td>
                    <td className="px-6 py-4 text-white/60">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
