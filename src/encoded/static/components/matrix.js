import React from 'react';
import PropTypes from 'prop-types';
import color from 'color';
import pluralize from 'pluralize';
import _ from 'underscore';
import url from 'url';
import { Panel, PanelBody } from '../libs/bootstrap/panel';
import { collapseIcon } from '../libs/svg-icons';
import DataTable from './datatable';
import * as globals from './globals';
import { BrowserSelector, MatrixInternalTags, ViewControls } from './objectutils';
import { BatchDownload, FacetList, TextFilter } from './search';


// Number of subcategory items to show when subcategory isn't disclosed.
const SUB_CATEGORY_SHORT_SIZE = 3;


class GroupMoreButton extends React.Component {
    constructor() {
        super();

        // Bind this to non-React components.
        this.localHandleClick = this.localHandleClick.bind(this);
    }

    localHandleClick() {
        this.props.handleClick(this.props.id);
    }

    render() {
        return <button className="group-more-cell__button" onClick={this.localHandleClick}>{this.props.displayText}</button>;
    }
}

GroupMoreButton.propTypes = {
    id: PropTypes.string, // ID for the handleClick function to know which control was clicked
    handleClick: PropTypes.func.isRequired, // Call this parent function to handle the click in the button
    displayText: PropTypes.string, // Text to display in the button while closed
};

GroupMoreButton.defaultProps = {
    id: '',
    displayText: '',
};


/**
 * Render a category row of the matrix without its subcategory rows.
 */
class CategoryRow extends React.Component {
    constructor() {
        super();
        this.handleClick = this.handleClick.bind(this);
    }

    /**
     * Called when the user clicks the expansion button to expand or collapse the section.
     */
    handleClick() {
        this.props.expandClickHandler(this.props.categoryName);
    }

    render() {
        const { filterHref, categoryName, categoryId, categoryColor, subCategoryLength, expanded } = this.props;
        return (
            <div style={{ backgroundColor: categoryColor }}>
                {subCategoryLength > SUB_CATEGORY_SHORT_SIZE ?
                    <button aria-expanded={expanded} aria-controls={categoryId} onClick={this.handleClick}>
                        {collapseIcon(!expanded)}
                    </button>
                :
                    <div className="matrix__row-category-spacer" />
                }
                <a href={filterHref} id={categoryId}>{categoryName}</a>
            </div>

        );
    }
}

CategoryRow.propTypes = {
    filterHref: PropTypes.string.isRequired,
    categoryName: PropTypes.string.isRequired,
    categoryId: PropTypes.string.isRequired,
    categoryColor: PropTypes.string.isRequired,
    subCategoryLength: PropTypes.number.isRequired,
    expanded: PropTypes.bool,
    expandClickHandler: PropTypes.func.isRequired,
};

CategoryRow.defaultProps = {
    expanded: false,
};


class SearchFilter extends React.Component {
    constructor() {
        super();
        this.onChange = this.onChange.bind(this);
    }

    onChange(href) {
        this.context.navigate(href);
    }

    render() {
        const { context } = this.props;
        const parsedUrl = url.parse(this.context.location_href);
        const matrixBase = parsedUrl.search || '';
        const matrixSearch = matrixBase + (matrixBase ? '&' : '?');
        const parsed = url.parse(matrixBase, true);
        const queryStringType = parsed.query.type || '';
        const type = pluralize(queryStringType.toLocaleLowerCase());
        return (
            <div className="matrix-general-search">
                <p>Enter search terms to filter the {type} included in the matrix.</p>
                <div className="general-search-entry">
                    <i className="icon icon-search" />
                    <div className="searchform">
                        <TextFilter filters={context.filters} searchBase={matrixSearch} onChange={this.onChange} />
                    </div>
                </div>
            </div>
        );
    }
}

SearchFilter.propTypes = {
    /** Matrix search results object */
    context: PropTypes.object.isRequired,
};

SearchFilter.contextTypes = {
    navigate: PropTypes.func,
    location_href: PropTypes.string,
};


const convertExperimentToDataTable = (context, expandedRowCategories, expandedClickHandler) => {
    const rowCategory = context.matrix.y.group_by[0];
    const rowSubCategory = context.matrix.y.group_by[1];
    const columnCategory = context.matrix.x.group_by;

    // Generate the top-row table header labels. First item null to allow for left-column row
    // headers.
    const colCategoryNames = context.matrix.x.buckets.map(colCategoryBucket => colCategoryBucket.key);
    const header = [{ header: <span />, css: 'matrix__col-category-header--corner' }].concat(colCategoryNames.map(colCategoryName => ({
        header: <a href={`${context.matrix.search_base}&${columnCategory}=${colCategoryName}`}>{colCategoryName}</a>,
    })));

    // Generate the main table content including the left header, row by row, starting with the
    // horizontal header as the initial accumulated row.
    const rowCategoryData = context.matrix.y[rowCategory].buckets;
    const rowCategoryColors = globals.biosampleTypeColors.colorList(rowCategoryData.map(rowDataValue => rowDataValue.key));
    const matrixRowKeys = ['column-categories'];
    let matrixRow = 1;
    const matrixDataTable = rowCategoryData.reduce((accumulatingTable, categoryBucket, rowCategoryIndex) => {
        const subCategoryData = categoryBucket[rowSubCategory].buckets;
        const rowCategoryColor = rowCategoryColors[rowCategoryIndex];
        const seriesColor = color(rowCategoryColor);

        // Generate one category's rows of subcategories, adding a header cell for each subcategory
        // on the left of the row.
        const categoryNameQuery = globals.encodedURIComponent(categoryBucket.key);
        const categoryExpanded = expandedRowCategories.indexOf(categoryBucket.key) !== -1;
        const renderedData = categoryExpanded ? subCategoryData : subCategoryData.slice(0, SUB_CATEGORY_SHORT_SIZE);
        matrixRowKeys[matrixRow] = categoryNameQuery;
        matrixRow += 1;
        const subCategoryRows = renderedData.map((subCategoryBucket) => {
            const cells = subCategoryBucket[columnCategory].map((cellData, columNum) => {
                const cellColor = seriesColor.clone();
                cellColor.lightness(cellColor.lightness() + ((1 - (cellData / context.matrix.max_cell_doc_count)) * (100 - cellColor.lightness())));
                const textColor = cellColor.luminosity() > 0.5 ? '#000' : '#fff';

                // Generate one data cell.
                return {
                    content: (
                        cellData > 0 ?
                            <a href={`${context.matrix.search_base}&${rowSubCategory}=${subCategoryBucket.key}&${columnCategory}=${colCategoryNames[columNum]}`} style={{ color: textColor }}>{cellData}</a>
                        : null
                    ),
                    style: { backgroundColor: cellData > 0 ? cellColor.hexString() : 'transparent' },
                };
            });

            // Add a single row's data and left header to the matrix.
            const subCategoryQuery = globals.encodedURIComponent(subCategoryBucket.key);
            matrixRowKeys[matrixRow] = `${categoryNameQuery}-${subCategoryQuery}`;
            matrixRow += 1;
            return {
                rowContent: [
                    {
                        header: <a href={`${context.matrix.search_base}&${rowSubCategory}=${subCategoryQuery}`}>{subCategoryBucket.key}</a>,
                    },
                ].concat(cells),
                css: 'matrix__row-data',
            };
        });

        // For the current category, collect the sum of every column into an array.
        // categoryBucket is object with categoryBucket[rowSubCategory].buckets being array representing each row within the category (e.g. 'cell line').
        // Each entry is object with categoryBucket[rowSubCategory].buckets[i][columnCategory] being array of counts, one per column
        const subCategorySums = [];
        categoryBucket[rowSubCategory].buckets.forEach((rowData) => {
            // `rowData` has all the data for one row
            rowData[columnCategory].forEach((value, colIndex) => {
                subCategorySums[colIndex] = (subCategorySums[colIndex] || 0) + value;
            });
        });

        // Generate a row for a row category alone, concatenated with the subcategory rows under
        // it. This concatenates one array of array (the row category cell) with another array of
        // arrays (the data rows that include their own left headers).
        return accumulatingTable.concat(
            [
                {
                    rowContent: [{
                        header: (
                            <CategoryRow
                                filterHref={`${context['@id']}&${rowCategory}=${categoryNameQuery}&y.limit=`}
                                categoryName={categoryBucket.key}
                                categoryId={categoryNameQuery}
                                categoryColor={rowCategoryColor}
                                subCategoryLength={subCategoryData.length}
                                expanded={categoryExpanded}
                                expandClickHandler={expandedClickHandler}
                            />
                        ),
                    }].concat(subCategorySums.map(subCategorySum => ({ content: <div style={{ backgroundColor: rowCategoryColor }}>{subCategorySum}</div> }))),
                    css: `matrix__row-category${rowCategoryIndex === 0 ? ' matrix__row-category--first' : ''}`,
                },
            ],
            subCategoryRows
        );
    }, [{ rowContent: header, css: 'matrix__col-category-header' }]);
    return { dataTable: matrixDataTable, rowKeys: matrixRowKeys };
};


const MatrixControls = ({ context }) => (
    <div className="matrix__controls">
        <h1>{context.title}</h1>
        <MatrixInternalTags context={context} />
        <ViewControls views={context.views} css="matrix__views" />
    </div>
);

MatrixControls.propTypes = {
    /** Search results object */
    context: PropTypes.object.isRequired,
};


// Render the title panel and the horizontal facets.
const MatrixHeader = (props) => {
    const { context } = props;

    return (
        <div className="matrix__header">
            <MatrixControls context={context} />
        </div>
    );
};

MatrixHeader.propTypes = {
    context: PropTypes.object.isRequired, // Summary search result object
};


/**
 * Render the vertical facets.
 */
class MatrixVerticalFacets extends React.Component {
    constructor() {
        super();

        // Bind `this` to non-React methods.
        this.onFilter = this.onFilter.bind(this);
    }

    onFilter(e) {
        const search = e.currentTarget.getAttribute('href');
        this.context.navigate(search);
        e.stopPropagation();
        e.preventDefault();
    }

    render() {
        const { context } = this.props;

        // Extract the vertical facets from the list of all facets using the array of selected
        // vertical facet fields.
        const vertFacets = context.facets.filter(facet => context.matrix.y.facets.indexOf(facet.field) >= 0);

        // Calculate the searchBase, which is the current search query string fragment that can have
        // terms added to it.
        const searchBase = `${url.parse(this.context.location_href).search}&` || '?';

        return (
            <div className="matrix__facets-vertical">
                <SearchFilter context={context} />
                <FacetList
                    facets={vertFacets}
                    filters={context.filters}
                    searchBase={searchBase}
                    onFilter={this.onFilter}
                    addClasses="matrix-facets"
                />
            </div>
        );
    }
}

MatrixVerticalFacets.propTypes = {
    context: PropTypes.object.isRequired, // Summary search result object
};

MatrixVerticalFacets.contextTypes = {
    /** Current URL */
    location_href: PropTypes.string,
    /** System navigation function */
    navigate: PropTypes.func,
};


class MatrixData extends React.Component {
    constructor() {
        super();
        this.state = {
            disclosedRowCategories: [],
        };
        this.discloseClickHandler = this.discloseClickHandler.bind(this);
    }

    /**
     * Called when the user clicks on the disclosure button on a category to collapse or expand it.
     * @param {string} category Key for the category
     */
    discloseClickHandler(category) {
        this.setState((prevState) => {
            const matchingCategoryIndex = prevState.disclosedRowCategories.indexOf(category);
            if (matchingCategoryIndex === -1) {
                // Category doesn't exist in array, so add it.
                return { disclosedRowCategories: prevState.disclosedRowCategories.concat(category) };
            }

            // Category does exist in array, so remove it.
            const disclosedCategories = prevState.disclosedRowCategories;
            return { disclosedRowCategories: [...disclosedCategories.slice(0, matchingCategoryIndex), ...disclosedCategories.slice(matchingCategoryIndex + 1)] };
        });
    }

    render() {
        // Convert encode data to a DataTable object.
        const { dataTable, rowKeys } = convertExperimentToDataTable(this.props.context, this.state.disclosedRowCategories, this.discloseClickHandler);
        const matrixConfig = {
            rows: dataTable,
            rowKeys,
            tableCss: 'matrix',
        };

        return (
            <DataTable tableData={matrixConfig} />
        );
    }
}

MatrixData.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};

/**
 * Display the horizontally scrolling matrix presentation area.
 */
class MatrixPresentation extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            leftShadingShowing: false,
            rightShadingShowing: false,
        };
        this.handleScrollShading = this.handleScrollShading.bind(this);
        this.handleOnScroll = this.handleOnScroll.bind(this);
    }

    componentDidMount() {
        // Establish initial matrix scroll shading.
        this.handleScrollShading(this.scrollElement);
    }

    /**
     * Apply shading along the left or right of the scrolling matrix DOM element based on its
     * current scrolled position.
     * @param {object} element DOM element to apply shading to
     */
    handleScrollShading(element) {
        if (element.scrollLeft === 0 && this.state.leftShadingShowing) {
            // Left edge of matrix scrolled into view.
            this.setState({ leftShadingShowing: false });
        } else if (element.scrollLeft + element.clientWidth === element.scrollWidth && this.state.rightShadingShowing) {
            // Right edge of matrix scrolled into view.
            this.setState({ rightShadingShowing: false });
        } else if (element.scrollLeft > 0 && !this.state.leftShadingShowing) {
            // Left edge of matrix scrolled out of view.
            this.setState({ leftShadingShowing: true });
        } else if (element.scrollLeft + element.clientWidth < element.scrollWidth && !this.state.rightShadingShowing) {
            // Right edge of matrix scrolled out of view.
            this.setState({ rightShadingShowing: true });
        }
    }

    /**
     * Called when the user scrolls the matrix horizontally within its div to handle the shading on
     * the left and right edges.
     * @param {object} e React synthetic event
     */
    handleOnScroll(e) {
        this.handleScrollShading(e.target);
    }

    render() {
        const { leftShadingShowing, rightShadingShowing } = this.state;

        return (
            <div className="matrix__data">
                <div className="matrix__data-content" onScroll={this.handleOnScroll} ref={(element) => { this.scrollElement = element; }}>
                    <MatrixData context={this.props.context} />
                </div>
                <div className={`matrix-shading matrix-shading--left${leftShadingShowing ? ' showing' : ''}`} />
                <div className={`matrix-shading matrix-shading--right${rightShadingShowing ? ' showing' : ''}`} />
            </div>
        );
    }
}

MatrixPresentation.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};


/**
 * Render the vertical facets and the matrix itself.
 */
const MatrixContent = ({ context }) => (
    <div className="matrix__content">
        <MatrixVerticalFacets context={context} />
        <MatrixPresentation context={context} />
    </div>
);

MatrixContent.propTypes = {
    /** Matrix search result object */
    context: PropTypes.object.isRequired,
};


class Matrix extends React.Component {
    static generateYGroupOpen(matrix) {
        // Make a state for each of the Y groups (each Y group currently shows a biosample type).
        // To do that, we have to get each of the bucket keys, which will be the keys into the
        // object that keeps track of whether the group shows all or not. If a group has fewer than
        // the maximum number of items to show a See More button, it doesn't get included in the
        // state.
        const primaryYGrouping = matrix.y.group_by[0];
        const secondaryYGrouping = matrix.y.group_by[1];
        const yLimit = matrix.y.limit;
        const yGroups = matrix.y[primaryYGrouping].buckets;
        const yGroupOpen = {};
        yGroups.forEach((group) => {
            if (group[secondaryYGrouping].buckets.length > yLimit) {
                yGroupOpen[group.key] = false;
            }
        });
        return yGroupOpen;
    }

    constructor(props) {
        super(props);

        // Set initial React state.
        const yGroupOpen = Matrix.generateYGroupOpen(this.props.context.matrix);
        this.state = {
            yGroupOpen,
        };

        // Bind this to non-React methods.
        this.onChange = this.onChange.bind(this);
        this.onFilter = this.onFilter.bind(this);
        this.updateElement = this.updateElement.bind(this);
        this.handleClick = this.handleClick.bind(this);
        this.handleSeeAllClick = this.handleSeeAllClick.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        // This callback makes possible updating the See More buttons when the user clicks a facet,
        // which could cause these buttons to not be needed. This resets all the buttons to the See
        // More state.
        const yGroupOpen = Matrix.generateYGroupOpen(nextProps.context.matrix);
        this.setState({
            yGroupOpen,
        });
    }

    onChange(href) {
        this.context.navigate(href);
    }

    onFilter(e) {
        const search = e.currentTarget.getAttribute('href');
        this.context.navigate(search);
        e.stopPropagation();
        e.preventDefault();
    }

    // Called when the Visualize button dropdown menu gets opened or closed. `dropdownEl` is the
    // DOM node for the dropdown menu. This sets inline CSS to set the height of the wrapper <div>
    // to make room for the dropdown.
    updateElement(dropdownEl) {
        const wrapperEl = this.hubscontrols;
        const dropdownHeight = dropdownEl.clientHeight;
        if (dropdownHeight === 0) {
            // The dropdown menu has closed
            wrapperEl.style.height = 'auto';
        } else {
            // The menu has dropped down
            wrapperEl.style.height = `${wrapperEl.clientHeight}${dropdownHeight}px`;
        }
    }

    // Handle a click in a See More link within the matrix (not for the facets)
    handleClick(groupKey) {
        const groupOpen = _.clone(this.state.yGroupOpen);
        groupOpen[groupKey] = !groupOpen[groupKey];
        this.setState({ yGroupOpen: groupOpen });
    }

    handleSeeAllClick() {
        this.setState((prevState) => {
            const newState = {};

            // If the See All button wasn't open (meaning this function was called because the user
            // wanted to see all), forget all the individual ones the user had opened so that
            // they're all closed when the user clicks See Fewer.
            if (!prevState.allYGroupsOpen) {
                const groupOpen = {};
                Object.keys(prevState.yGroupOpen).forEach((key) => {
                    groupOpen[key] = false;
                });
                newState.yGroupOpen = groupOpen;
            }

            // Toggle the state of allYGroupsOpen.
            newState.allYGroupsOpen = !prevState.allYGroupsOpen;
            return newState;
        });
    }

    render() {
        const { context } = this.props;
        const itemClass = globals.itemClass(context, 'view-item');

        if (context.matrix.doc_count) {
            return (
                <Panel addClasses={itemClass}>
                    <PanelBody>
                        <MatrixHeader context={context} />
                        <MatrixContent context={context} />
                    </PanelBody>
                </Panel>
            );
        }
        return <h4>No results found</h4>;
    }
}

Matrix.propTypes = {
    context: React.PropTypes.object.isRequired,
};

Matrix.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
    biosampleTypeColors: PropTypes.object, // DataColor instance for experiment project
};

globals.contentViews.register(Matrix, 'Matrix');
