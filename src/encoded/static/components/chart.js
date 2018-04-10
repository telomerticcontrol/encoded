import React from 'react';
import PropTypes from 'prop-types';
import { FetchedData, Param } from './fetched';


/**
 * Create a column chart in the given div.
 *
 * @param {string} chartId - Root HTML id of div to draw the chart into. Supply <divs> with
 *         `chartId`-chart for the chart canvas.
 * @param {array} datasets - Array of objects, each one describing one dataset sharing the chart.
 *         * name - Name of the dataset; used for the legend
 *         * color - Hex color of all the columns for this dataset
 *         * values - Array of number values to plot on the Y-axis of the chart; should have the
 *                    same number of entries as the `categories` parameter.
 * @param {array} categories - Array of the names of each set of data sharing this chart, allowing
 *         for overlapping bar charts. These names get displayed in the legend.
 * @param {bool} stacked - True if columns display as stacked; False if overlapped
 */
class ColumnChart {
    constructor(chartId, datasets, categories, stacked) {
        this.chartInstance = null;
        this.chartId = chartId;
        this.datasets = datasets;
        this.categories = categories;
        this.stacked = stacked;
        this._createColumnChart();
    }

    // Convert incoming datasets to a form chart.js can use.
    _datasetsToChartData() {
        const chartDatasets = [];
        this.datasets.forEach((dataset) => {
            chartDatasets.push({
                label: dataset.name || '',
                backgroundColor: dataset.color,
                data: dataset.values,
            });
        });
        return chartDatasets;
    }

    // Create a new chart instance from given data.
    _instantiateColumnChart() {
        return new Promise((resolve) => {
            require.ensure(['chart.js'], (require) => {
                const Chart = require('chart.js');

                // Configure the chart <div> canvas with the height and width of the <div>.
                const canvas = document.getElementById(`${this.chartId}-chart`);
                const parent = document.getElementById(this.chartId);
                canvas.width = parent.offsetWidth;
                canvas.height = parent.offsetHeight;
                canvas.style.width = `${parent.offsetWidth}px`;
                canvas.style.height = `${parent.offsetHeight}px`;
                const chartData = this._datasetsToChartData();

                // Have chartjs render the chart.
                const ctx = canvas.getContext('2d');
                const chart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: this.categories,
                        datasets: chartData,
                    },
                    options: {
                        maintainAspectRatio: false,
                        responsive: true,
                        legend: {
                            display: this.datasets.length > 1,
                        },
                        animation: {
                            duration: 0,
                        },
                        scales: {
                            yAxes: [{
                                stacked: this.stacked,
                            }],
                        },
                    },
                });
                resolve(chart);
            });
        });
    }

    // Manage chart-creation to retrieve and save the chart instance.
    _createColumnChart() {
        this._instantiateColumnChart().then((chartInstance) => { this.chartInstance = chartInstance; });
    }

    // Called by client when new data comes in.
    updateColumnChart(nextDatasets) {
        if (this.chartInstance) {
            this.datasets = nextDatasets;
            const chartData = this._datasetsToChartData();
            this.chartInstance.data.datasets = chartData;
            this.chartInstance.update();
        }
    }

    getChartInstance() {
        return this.chartInstance;
    }
}


// Called when experiment/replicates search results return. This triggers the rendering of the
// experiment/library counts chart.
class LibraryCountsChartRenderer extends React.Component {
    constructor() {
        super();
        this.columnChart = null;
    }

    componentDidMount() {
        this.columnChart = new ColumnChart('library-counts', this.generateChartDataset(), ['0', '1', '2', '3', '4', '5+']);
    }

    componentDidUpdate() {
        this.columnChart.updateColumnChart(this.generateChartDataset());
    }

    // Use the incoming experiment/replicate search results to generate data for the ColumnChart.
    generateChartDataset() {
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
        return [{
            name: 'Experiment library counts',
            color: '#2f62cf',
            values: libraryCountCategories,
        }];
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


// Externally visible component that performs a GET request to search for Experiments with at least
// one library.
const LibraryCountsChart = ({ searchQuery }) => (
    <FetchedData addCss="award-charts__chart">
        <Param name="experimentReplicates" url={`/search/?type=Experiment&field=replicates.library.accession&limit=all${searchQuery}`} />
        <LibraryCountsChartRenderer />
    </FetchedData>
);

LibraryCountsChart.propTypes = {
    searchQuery: PropTypes.string, // Query string to add to this component's search query
};

LibraryCountsChart.defaultProps = {
    searchQuery: '',
};

export default LibraryCountsChart;
