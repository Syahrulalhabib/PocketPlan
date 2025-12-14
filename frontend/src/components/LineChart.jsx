import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js';
import { useMemo } from 'react';

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend);

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Okt', 'Nov', 'Dec'];

const LineChart = ({ transactions }) => {
  const data = useMemo(() => {
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);
    transactions.forEach((t) => {
      const month = new Date(t.date).getMonth();
      if (t.type === 'Income') incomeData[month] += Number(t.amount);
      if (t.type === 'Expense') expenseData[month] += Number(t.amount);
    });
    return {
      labels: months,
      datasets: [
        {
          label: 'Pemasukkan',
          data: incomeData,
          borderColor: '#5b77ff',
          backgroundColor: '#5b77ff',
          tension: 0.35,
          pointRadius: 4
        },
        {
          label: 'Pengeluaran',
          data: expenseData,
          borderColor: '#e45153',
          backgroundColor: '#e45153',
          tension: 0.35,
          pointRadius: 4
        }
      ]
    };
  }, [transactions]);

  const options = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' }
    },
    scales: {
      y: { beginAtZero: true }
    }
  };

  return <Line data={data} options={options} />;
};

export default LineChart;
