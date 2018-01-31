import React from 'react';
import PropTypes from 'prop-types';
import color from 'color';
import _ from 'underscore';
import url from 'url';
import { svgIcon } from '../libs/svg-icons';
import * as globals from './globals';
import { BrowserSelector } from './objectutils';
import { BatchDownload, FacetList, TextFilter } from './search';


// Map view icons to svg icons
const view2svg = {
    'list-alt': 'search',
    table: 'table',
};


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
            allYGroupsOpen: false,
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
            allYGroupsOpen: false,
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
        const context = this.props.context;
        const matrix = context.matrix;
        const parsedUrl = url.parse(this.context.location_href);
        const matrixBase = parsedUrl.search || '';
        const matrixSearch = matrixBase + (matrixBase ? '&' : '?');
        const notification = context.notification;
        const visualizeLimit = 500;
        if (notification === 'Success' || notification === 'No results found') {
            const xFacets = matrix.x.facets.map(f => _.findWhere(context.facets, { field: f })).filter(f => f);
            let yFacets = matrix.y.facets.map(f => _.findWhere(context.facets, { field: f })).filter(f => f);
            yFacets = yFacets.concat(_.reject(context.facets, f => _.contains(matrix.x.facets, f.field) || _.contains(matrix.y.facets, f.field)));
            const xGrouping = matrix.x.group_by;
            const primaryYGrouping = matrix.y.group_by[0];
            const secondaryYGrouping = matrix.y.group_by[1];
            const xBuckets = matrix.x.buckets;
            const xLimit = matrix.x.limit || xBuckets.length;
            const yGroups = matrix.y[primaryYGrouping].buckets;
            const yGroupFacet = _.findWhere(context.facets, { field: primaryYGrouping });
            const yGroupOptions = yGroupFacet ? yGroupFacet.terms.map(term => term.key) : [];
            yGroupOptions.sort();
            const searchBase = context.matrix.search_base;
            const visualizeDisabled = matrix.doc_count > visualizeLimit;
            const colCount = Math.min(xBuckets.length, xLimit + 1);

            // Get a sorted list of batch hubs keys with case-insensitive sort
            // NOTE: Tim thinks this is overkill as opposed to simple sort()
            let visualizeKeys = [];
            if (context.visualize_batch && Object.keys(context.visualize_batch).length) {
                visualizeKeys = Object.keys(context.visualize_batch).sort((a, b) => {
                    const aLower = a.toLowerCase();
                    const bLower = b.toLowerCase();
                    return (aLower > bLower) ? 1 : ((aLower < bLower) ? -1 : 0);
                });
            }

            // Make an array of colors corresponding to the ordering of biosample_type
            const biosampleTypeColors = this.context.biosampleTypeColors.colorList(yGroups.map(yGroup => yGroup.key));

            return (
                <div>
                    <div className="panel data-display main-panel">
                        <div className="row">
                            <div className="col-sm-5 col-md-4 col-lg-3 sm-no-padding" style={{ paddingRight: 0 }}>
                                <div className="row">
                                    <div className="col-sm-11">
                                        <div>
                                            <h3 style={{ marginTop: 0 }}>{context.title}</h3>
                                            <div>
                                                <p>Click or enter search terms to filter the experiments included in the matrix.</p>
                                                <TextFilter filters={context.filters} searchBase={matrixSearch} onChange={this.onChange} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-sm-7 col-md-8 col-lg-9 sm-no-padding" style={{ paddingLeft: 0 }}>
                                <FacetList
                                    facets={xFacets}
                                    filters={context.filters}
                                    orientation="horizontal"
                                    searchBase={matrixSearch}
                                    onFilter={this.onFilter}
                                />
                            </div>
                        </div>
                        <div className="row">
                            <div className="col-sm-5 col-md-4 col-lg-3 sm-no-padding" style={{ paddingRight: 0 }}>
                                <FacetList facets={yFacets} filters={context.filters} searchBase={matrixSearch} onFilter={this.onFilter} />
                            </div>
                            <div className="col-sm-7 col-md-8 col-lg-9 sm-no-padding">
                                <div className="matrix-wrapper">
                                    <div className="matrix-group-heading">
                                        <div className="matrix-group-heading__content">
                                            {matrix.y.label.toUpperCase()}
                                        </div>
                                    </div>
                                    <table className="matrix">
                                        <tbody>
                                            {matrix.doc_count ?
                                                <tr>
                                                    <th style={{ width: 20 }} />
                                                    <th colSpan={colCount + 1} style={{ padding: '5px', borderBottom: 'solid 1px #ddd', textAlign: 'center' }}>{matrix.x.label.toUpperCase()}</th>
                                                </tr>
                                            : null}
                                            <tr style={{ borderBottom: 'solid 1px #ddd' }}>
                                                <th style={{ textAlign: 'center', width: 200 }}>
                                                    <h3>
                                                      {matrix.doc_count} results
                                                    </h3>
                                                    <div className="btn-attached">
                                                        {matrix.doc_count && context.views ? context.views.map(view => <a href={view.href} key={view.icon} className="btn btn-info btn-sm btn-svgicon" title={view.title}>{svgIcon(view2svg[view.icon])}</a>) : ''}
                                                    </div>
                                                    {context.filters.length ?
                                                        <div className="clear-filters-control-matrix">
                                                            <a href={context.matrix.clear_matrix}>Clear Filters <i className="icon icon-times-circle" /></a>
                                                        </div>
                                                    : null}
                                                </th>
                                                {xBuckets.map((xb, i) => {
                                                    if (i < xLimit) {
                                                        const href = `${searchBase}&${xGrouping}=${globals.encodedURIComponent(xb.key)}`;
                                                        return <th key={i} className="rotate30" style={{ width: 10 }}><div><a title={xb.key} href={href}>{xb.key}</a></div></th>;
                                                    } else if (i === xLimit) {
                                                        const parsed = url.parse(matrixBase, true);
                                                        parsed.query['x.limit'] = null;
                                                        delete parsed.search; // this makes format compose the search string out of the query object
                                                        const unlimitedHref = url.format(parsed);
                                                        return <th key={i} className="rotate30" style={{ width: 10 }}><div><span><a href={unlimitedHref}>...and {xBuckets.length - xLimit} more</a></span></div></th>;
                                                    }
                                                    return null;
                                                })}
                                            </tr>
                                            {yGroups.map((group, i) => {
                                                const groupColor = biosampleTypeColors[i];
                                                const seriesColor = color(groupColor);
                                                const parsed = url.parse(matrixBase, true);
                                                parsed.query[primaryYGrouping] = group.key;
                                                parsed.query['y.limit'] = null;
                                                delete parsed.search; // this makes format compose the search string out of the query object
                                                const groupHref = url.format(parsed);
                                                const rows = [<tr key={group.key}>
                                                    <th colSpan={colCount + 1} style={{ textAlign: 'left', backgroundColor: groupColor }}>
                                                        <a href={groupHref} style={{ color: '#fff' }}>{group.key}</a>
                                                    </th>
                                                </tr>];
                                                const groupBuckets = group[secondaryYGrouping].buckets;
                                                const yLimit = matrix.y.limit || groupBuckets.length;

                                                // If this group isn't open (noted by
                                                // this.state.yGroupOpen[key]), extract just the
                                                // group rows that are under the display limit.
                                                const groupRows = (this.state.yGroupOpen[group.key] || this.state.allYGroupsOpen) ? groupBuckets : groupBuckets.slice(0, yLimit);
                                                rows.push(...groupRows.map((yb) => {
                                                    const href = `${searchBase}&${secondaryYGrouping}=${globals.encodedURIComponent(yb.key)}`;
                                                    return (
                                                        <tr key={yb.key}>
                                                            <th style={{ backgroundColor: '#ddd', border: 'solid 1px white' }}><a href={href}>{yb.key}</a></th>
                                                            {xBuckets.map((xb, k) => {
                                                                if (k < xLimit) {
                                                                    const value = yb[xGrouping][k];
                                                                    const cellColor = seriesColor.clone();
                                                                    // scale color between white and the series color
                                                                    cellColor.lightness(cellColor.lightness() + ((1 - (value / matrix.max_cell_doc_count)) * (100 - cellColor.lightness())));
                                                                    const textColor = cellColor.luminosity() > 0.5 ? '#000' : '#fff';
                                                                    const cellHref = `${searchBase}&${secondaryYGrouping}=${globals.encodedURIComponent(yb.key)}&${xGrouping}=${globals.encodedURIComponent(xb.key)}`;
                                                                    const title = `${yb.key} / ${xb.key}: ${value}`;
                                                                    return (
                                                                        <td key={xb.key} style={{ backgroundColor: cellColor.hexString() }}>
                                                                            {value ? <a href={cellHref} style={{ color: textColor }} title={title}>{value}</a> : null}
                                                                        </td>
                                                                    );
                                                                }
                                                                return null;
                                                            })}
                                                            {xBuckets.length > xLimit && <td />}
                                                        </tr>
                                                    );
                                                }));
                                                if (groupBuckets.length > yLimit && !this.state.allYGroupsOpen) {
                                                    rows.push(
                                                        <tr>
                                                            <th className="group-more-cell">
                                                                <GroupMoreButton
                                                                    id={group.key}
                                                                    handleClick={this.handleClick}
                                                                    displayText={this.state.yGroupOpen[group.key] ? '- See fewer' : `+ See ${groupBuckets.length - yLimit} more…`}
                                                                />
                                                            </th>
                                                            {_.range(colCount - 1).map(n => <td key={n} />)}
                                                        </tr>
                                                    );
                                                }
                                                return rows;
                                            })}

                                            {/* Display the See Fewer/See All button controlling
                                                the whole table if at least one biosample_type has
                                                more than the limit. We know this is the case if at
                                                least one yGroupOpen state member exists. */}
                                            {Object.keys(this.state.yGroupOpen).length ?
                                                <tr>
                                                    <th className="group-all-groups-cell">
                                                        <button className="group-all-groups-cell__button" onClick={this.handleSeeAllClick}>
                                                            {this.state.allYGroupsOpen ? 'See fewer biosamples' : 'See all biosamples'}
                                                        </button>
                                                    </th>
                                                </tr>
                                            : null}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="hubs-controls" ref="hubscontrols">
                                    {context.batch_download ?
                                        <BatchDownload context={context} />
                                    : null}
                                    {' '}
                                    {visualizeKeys.length ?
                                        <BrowserSelector
                                            visualizeCfg={context.visualize_batch}
                                            disabled={visualizeDisabled}
                                            title={visualizeDisabled ? `Filter to ${visualizeLimit} to visualize` : 'Visualize'}
                                        />
                                    : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }
        return <h4>{notification}</h4>;
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


class MatrixTarget extends React.Component {
    constructor() {
        super();

        // Bind `this` to non-React components.
        this.onChange = this.onChange.bind(this);
    }

    onChange(href) {
        this.context.navigate(href);
    }

    render() {
        const { context } = this.props;
        const { location_href } = this.context;

        if (context.notification !== 'Success' && context.notification !== 'No results found') {
            return <h4>{context.notification}</h4>;
        }

        const matrix = context.matrix;
        const xBuckets = matrix.x.buckets;
        const primaryXGrouping = matrix.x.group_by_target[0];
        const secondaryXGrouping = matrix.x.group_by_target[1];
        const primaryYGrouping = matrix.y.group_by[0];
        const secondaryYGrouping = matrix.y.group_by[1];
        const yBuckets = matrix.y[primaryYGrouping].buckets;

        // Count the number of horizontal columns which includes the length of each child bucket
        // array plus 1 for the parent bucket title.
        const colCount = xBuckets.reduce((acc, outerBucket) => acc + outerBucket[secondaryXGrouping].buckets.length + 1, 0);

        // Come up with a search query string to use as a base for <TextFilter> used when someone
        // enters some text into the matrix search box. It has to refer back to this matrix page,
        // so we start with `location_href`.
        const parsedUrl = url.parse(location_href);
        const matrixBase = parsedUrl.search || '';
        const matrixSearch = `${matrixBase}${matrixBase ? '&' : '?'}`;
        const searchBase = matrix.search_base;

        // The context.matrix.x.facets and context.matrix.y.facets arrays specify which elements
        // of context.facets should be included in the horizontal and vertical facets. Use those
        // to select context.facet objects to display in each facet area on the page. Additionally,
        // any context.facets objects that *aren't* included in matrix.x.facets nor matrix.y.facets
        // get tacked onto the end of vertFacets.
        const horzFacets = context.facets.filter(facet => matrix.x.facets.indexOf(facet.field) > -1);
        const vertFacets = context.facets.filter(facet => matrix.y.facets.indexOf(facet.field) > -1).concat(
            context.facets.filter(facet => (
                matrix.x.facets.indexOf(facet.field) === -1 && matrix.y.facets.indexOf(facet.field) === -1
            ))
        );

        return (
            <div>
                <div className="panel data-display main-panel">
                    <div className="row">
                        {/* Title and search box */}
                        <div className="col-sm-5 col-md-4 col-lg-3 sm-no-padding matrix-facet-area matrix-facet-area--right">
                            <div className="row">
                                <div className="col-sm-11">
                                    <div>
                                        <h3>{context.title}</h3>
                                        <div>
                                            <p>Click or enter search terms to filter the experiments included in the matrix.</p>
                                            <TextFilter filters={context.filters} searchBase={matrixSearch} onChange={this.onChange} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Horizontal facets */}
                        <div className="col-sm-7 col-md-8 col-lg-9 sm-no-padding matrix-facet-area matrix-facet-area--left">
                            <FacetList
                                facets={horzFacets}
                                filters={context.filters}
                                orientation="horizontal"
                                searchBase={matrixSearch}
                                onFilter={this.onFilter}
                            />
                        </div>

                        {/* Vertical facets and matrix itself */}
                        <div className="row">
                            <div className="col-sm-5 col-md-4 col-lg-3 sm-no-padding matrix-facet-area matrix-facet-area--right">
                                <FacetList
                                    facets={vertFacets}
                                    filters={context.filters}
                                    searchBase={matrixSearch}
                                    onFilter={this.onFilter}
                                />
                            </div>
                            <div className="col-sm-7 col-md-8 col-lg-9 sm-no-padding">
                                <div className="matrix-wrapper">
                                    <div className="matrix-group-heading">
                                        <div className="matrix-group-heading__content">
                                            {matrix.y.label.toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                                <table className="matrix">
                                    <tbody>
                                        {matrix.doc_count ?
                                            <tr className="matrix-title">
                                                <th className="matrix-title__spacer" />
                                                <th className="matrix-title__text" colSpan={colCount + 1}>{matrix.x.label_target.toUpperCase()}</th>
                                            </tr>
                                        : null}
                                        <tr className="matrix-header">
                                            <th className="matrix-header__controls">
                                                <h3>{matrix.doc_count} results</h3>
                                                <div className="btn-attached">
                                                    {matrix.doc_count && context.views ? context.views.map(view => <a href={view.href} key={view.icon} className="btn btn-info btn-sm btn-svgicon" title={view.title}>{svgIcon(view2svg[view.icon])}</a>) : ''}
                                                </div>
                                                {context.filters.length ?
                                                    <div className="clear-filters-control-matrix">
                                                        <a href={context.matrix.clear_matrix}>Clear Filters <i className="icon icon-times-circle" /></a>
                                                    </div>
                                                : null}
                                            </th>

                                            {/* Display horizontal column headers */}
                                            {xBuckets.map((primaryBucket) => {
                                                // Display parent column titles with child column
                                                // titles appended to it so we have a straight
                                                // array of <th> elements.
                                                const primaryHref = `${searchBase}&${primaryXGrouping}=${globals.encodedURIComponent(primaryBucket.key)}`;
                                                const secondaryColumns = primaryBucket[secondaryXGrouping].buckets.map((secondaryBucket) => {
                                                    const secondaryHref = `${searchBase}&${primaryXGrouping}=${globals.encodedURIComponent(primaryBucket.key)}&${secondaryXGrouping}=${globals.encodedURIComponent(secondaryBucket.key)}`;
                                                    return <th key={`${primaryBucket.key}${secondaryBucket.key}`} className="rotate30 matrix-header__titles"><div><a href={secondaryHref}>{secondaryBucket.key}</a></div></th>;
                                                });
                                                return [<th key={primaryBucket.key} className="rotate30 matrix-header__titles"><div><a href={primaryHref}>{primaryBucket.key}</a></div></th>].concat(secondaryColumns);
                                            })}
                                        </tr>

                                        {/* Display each row of the matrix. This represents a
                                            hierarchy the same as the experiment/annotation matrix.
                                            `primaryBucket` holds the buckets for the top-level row
                                            hierarchy while secondaryBucket refers to each bucket
                                            within. The horizontal hierarchy gets specified within
                                            the secondaryBucket objects. */}
                                        {yBuckets.map((primaryBucket) => {
                                            const secondaryRows = primaryBucket[secondaryYGrouping].buckets.map(secondaryBucket => (
                                                <tr>
                                                    <th key={`${primaryBucket.key}${secondaryBucket.key}`}><a>{secondaryBucket.key}</a></th>
                                                    {matrix.x.buckets.map((primaryXBucket) => {
                                                        const matchingXGroupBucket = secondaryBucket[primaryXGrouping].buckets.find(bucket => bucket.key === primaryXBucket.key);
                                                        if (matchingXGroupBucket) {
                                                            // Found a target bucket matching the
                                                            // current matrix target column
                                                            // section.
                                                            return [<td />].concat(matchingXGroupBucket[secondaryXGrouping].map(value => (value ? <td>{value}</td> : <td />)));
                                                        }

                                                        // No matching primary group for the
                                                        // columns, Generate enough empty cells
                                                        // to fill that part of the table.
                                                        return [<td />].concat(primaryXBucket[secondaryXGrouping].buckets.map((() => <td />)));
                                                    })}
                                                </tr>
                                            ));
                                            return (
                                                [
                                                    <tr key={primaryBucket.key}>
                                                        <th colSpan={colCount + 1} style={{ textAlign: 'left' }}>
                                                            <a>{primaryBucket.key}</a>
                                                        </th>
                                                    </tr>,
                                                ].concat(secondaryRows)
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

MatrixTarget.propTypes = {
    context: React.PropTypes.object.isRequired, // Search results JSON
};

MatrixTarget.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
};

globals.contentViews.register(MatrixTarget, 'MatrixTarget');
