/**
 * Create a column chart in the given div.
 *
 * @param {string} chartId - Root HTML id of div to draw the chart into. Supply <divs> with
 *         `chartId`-chart for the chart canvas, and `chartId`-legend for its legend.
 * @param {array} categories - Array of the names of each set of data sharing this chart, allowing
 *         for overlapping bar charts. These names get displayed in the legend.
 * @param {array} datasets - Array of objects, each one describing one dataset sharing the chart.
 *         * name - Name of the dataset; used for the legend
 *         * color - Hex color of all the columns for this dataset
 *         * values - Array of number values to plot on the Y-axis of the chart; should have the
 *                    same number of entries as the `categories` parameter.
 * @param {bool} stacked - True if columns display as stacked; False if overlapped
 * @return {promise}
 */
const renderColumnChart = (chartId, categories, datasets, stacked) => (
    new Promise((resolve) => {
        require.ensure(['chart.js'], (require) => {
            // Configure the chart <div> canvas with the height and width of the <div>.
            const canvas = document.getElementById(`${chartId}-chart`);
            const parent = document.getElementById(chartId);
            canvas.width = parent.offsetWidth;
            canvas.height = parent.offsetHeight;
            canvas.style.width = `${parent.offsetWidth}px`;
            canvas.style.height = `${parent.offsetHeight}px`;

            // Set up the chartjs dataset array.
            const chartDatasets = [];
            datasets.forEach((dataset) => {
                chartDatasets.push({
                    label: dataset.name || '',
                    backgroundColor: dataset.color,
                    data: dataset.values,
                });
            });

            // Have chartjs render the chart.
            const ctx = canvas.getContext('2d');
            const Chart = require('chart.js');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: categories,
                    datasets: chartDatasets,
                },
                options: {
                    maintainAspectRatio: false,
                    responsive: true,
                    legend: {
                        display: datasets.length > 1,
                    },
                    animation: {
                        duration: 0,
                    },
                    scales: {
                        yAxes: [{
                            stacked,
                        }],
                    },
                },
            });

            // Waiting promises receive the chart instance reference.
            resolve(chart);
        });
    })
);

export default renderColumnChart;
