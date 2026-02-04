import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ChartDataItem {
  name: string;
  hours: number;
}

interface DashboardChartProps {
  data: ChartDataItem[];
}

/**
 * Chart tách riêng để lazy load Recharts - giảm bundle ban đầu,
 * cải thiện LCP và Time to Interactive trên mobile.
 */
const DashboardChart: React.FC<DashboardChartProps> = ({ data }) => (
  <div className="h-40">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} dy={10} />
        <Tooltip
          cursor={{ fill: '#f0f9ff', radius: 6 }}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '12px' }}
        />
        <Bar dataKey="hours" radius={[6, 6, 6, 6]} barSize={12}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.hours >= 8 ? '#3b82f6' : '#cbd5e1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default React.memo(DashboardChart);
