import React from 'react';
import PropTypes from 'prop-types';
import { FetchedData, Param } from './fetched';


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
            const Chart = require('chart.js');

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

export { renderColumnChart };


class LibraryCountsChartRenderer extends React.Component {
    componentDidMount() {
        const { experimentReplicates } = this.props;

        // Initialize our data array to count experiments with 0, 1, 2, 3, 4, or 5+ libraries.
        const libraryCountCategories = [0, 0, 0, 0, 0, 0];

        // Loop through every experiment and get each library count, then add it to the corresponding
        // count category to use in the graph.
        experimentReplicates['@graph'].forEach((experiment) => {
            const libraryCount = experiment.replicates ? experiment.replicates.length : 0;
            libraryCountCategories[libraryCount >= 5 ? 5 : libraryCount] += 1;
        });

        // Build the dataset for the charting function and render the chart.
        const libraryCountDataset = {
            name: 'Experiment library counts',
            color: '#2f62cf',
            values: libraryCountCategories,
        };
        renderColumnChart('library-counts', ['0', '1', '2', '3', '4', '5+'], [libraryCountDataset]);
    }

    render() {
        return (
            <div>
                <div className="title">
                    Experiment library counts
                </div>
                <div className="award-charts__visual">
                    <div id="library-counts">
                        <canvas id="library-counts-chart" />
                    </div>
                </div>
            </div>
        );
    }
}

LibraryCountsChartRenderer.propTypes = {
    experimentReplicates: PropTypes.object, // Actually required, but comes from GET request
};

LibraryCountsChartRenderer.defaultProps = {
    experimentReplicates: null,
};


const LibraryCountsChart = () => (
    <FetchedData addCss="award-charts__chart">
        <Param name="experimentReplicates" url="/search/?type=Experiment&field=replicates.library.accession&limit=all" />
        <LibraryCountsChartRenderer />
    </FetchedData>
);

export { LibraryCountsChart };
