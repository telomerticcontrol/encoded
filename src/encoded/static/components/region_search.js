import React from 'react';
import PropTypes from 'prop-types';
import url from 'url';
import { BrowserSelector } from './objectutils';
import { Panel, PanelBody } from '../libs/bootstrap/panel';
import { FacetList, Listing } from './search';
import { FetchedData, Param } from './fetched';
import * as globals from './globals';
// import { entryPoint } from '../libs/d3-sequence-logo';


const regionGenomes = [
    { value: 'GRCh37', display: 'hg19' },
    { value: 'GRCh38', display: 'GRCh38' },
    { value: 'GRCm37', display: 'mm9' },
    { value: 'GRCm38', display: 'mm10' },
];
const regulomeGenomes = [
    { value: 'GRCh37', display: 'hg19' },
    { value: 'GRCh38', display: 'GRCh38' },
];


const AutocompleteBox = (props) => {
    const terms = props.auto['@graph']; // List of matching terms from server
    const handleClick = props.handleClick;
    const userTerm = props.userTerm && props.userTerm.toLowerCase(); // Term user entered

    if (!props.hide && userTerm && userTerm.length && terms && terms.length) {
        return (
            <ul className="adv-search-autocomplete">
                {terms.map((term) => {
                    let matchEnd;
                    let preText;
                    let matchText;
                    let postText;

                    // Boldface matching part of term
                    const matchStart = term.text.toLowerCase().indexOf(userTerm);
                    if (matchStart >= 0) {
                        matchEnd = matchStart + userTerm.length;
                        preText = term.text.substring(0, matchStart);
                        matchText = term.text.substring(matchStart, matchEnd);
                        postText = term.text.substring(matchEnd);
                    } else {
                        preText = term.text;
                    }
                    return (
                        <AutocompleteBoxMenu
                            key={term.text}
                            handleClick={handleClick}
                            term={term}
                            name={props.name}
                            preText={preText}
                            matchText={matchText}
                            postText={postText}
                        />
                    );
                }, this)}
            </ul>
        );
    }

    return null;
};

AutocompleteBox.propTypes = {
    auto: PropTypes.object,
    userTerm: PropTypes.string,
    handleClick: PropTypes.func,
    hide: PropTypes.bool,
    name: PropTypes.string,
};

AutocompleteBox.defaultProps = {
    auto: {}, // Looks required, but because it's built from <Param>, it can fail type checks.
    userTerm: '',
    handleClick: null,
    hide: false,
    name: '',
};


// Draw the autocomplete box drop-down menu.
class AutocompleteBoxMenu extends React.Component {
    constructor() {
        super();

        // Bind this to non-React methods.
        this.handleClick = this.handleClick.bind(this);
    }

    // Handle clicks in the drop-down menu. It just calls the parent's handleClick function, giving
    // it the parameters of the clicked item.
    handleClick() {
        const { term, name } = this.props;
        this.props.handleClick(term.text, term._source.payload.id, name);
    }

    render() {
        const { preText, matchText, postText } = this.props;

        /* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex, jsx-a11y/click-events-have-key-events */
        return (
            <li tabIndex="0" onClick={this.handleClick}>
                {preText}<b>{matchText}</b>{postText}
            </li>
        );
        /* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex, jsx-a11y/click-events-have-key-events */
    }
}

AutocompleteBoxMenu.propTypes = {
    handleClick: PropTypes.func.isRequired, // Parent function to handle a click in a drop-down menu item
    term: PropTypes.object.isRequired, // Object for the term being searched
    name: PropTypes.string,
    preText: PropTypes.string, // Text before the matched term in the entered string
    matchText: PropTypes.string, // Matching text in the entered string
    postText: PropTypes.string, // Text after the matched term in the entered string
};

AutocompleteBoxMenu.defaultProps = {
    name: '',
    preText: '',
    matchText: '',
    postText: '',
};

class AboutRegulome extends React.Component {
    render () {
        return(
            <div className="about-regulome">

                <div className="text-block">
                    <h4>To cite RegulomeDB:</h4>
                    <p>Boyle AP, Hong EL, Hariharan M, Cheng Y, Schaub MA, Kasowski M, Karczewski KJ, Park J, Hitz BC, Weng S, Cherry JM, Snyder M. Annotation of functional variation in personal genomes using RegulomeDB. Genome Research 2012, 22(9):1790-1797. PMID: 22955989.</p>
                </div>

                <div className="text-block">
                    <h4>To contact RegulomeDB:</h4>
                    <a href="mailto:regulomedb@mailman.stanford.edu">regulomedb@mailman.stanford.edu</a>
                </div>
            </div>
        )
    }
}

class Intro extends React.Component {
    render () {
        return(
            <div className="about-regulome introduction">
                <p>RegulomeDB is a database that annotates SNPs with known and predicted regulatory elements in the intergenic regions of the H. sapiens genome. Known and predicted regulatory DNA elements include regions of DNAase hypersensitivity, binding sites of transcription factors, and promoter regions that have been biochemically characterized to regulation transcription. Source of these data include public datasets from GEO, the ENCODE project, and published literature.</p>
            </div>
        )
    }
}

class DataTypes extends React.Component {

    constructor() {
        super();

        // Bind this to non-React methods.
        this.handleInfo = this.handleInfo.bind(this);
    }

    handleInfo(e) {
        let infoId = e.target.id.split("data-type-")[1];
        if (infoId){
            let infoElement = document.getElementById("data-explanation-"+infoId);
            infoElement.classList.toggle("show");
            // $(e.target.id).find("i").toggleClass("icon-caret-down icon-caret-right");
            let iconElement = e.target.getElementsByTagName("i")[0];
            if (e.target.getElementsByTagName("i")[0].className.indexOf("icon-caret-right") > -1){
                iconElement.classList.add("icon-caret-down");
                iconElement.classList.remove("icon-caret-right");
            } else {
                iconElement.classList.remove("icon-caret-down");
                iconElement.classList.add("icon-caret-right");
            }

        }
    }

    render () {
        return(
            <div className="data-types">
                <div className="data-types-instructions"><h4>Use RegulomeDB to identify DNA features and regulatory elements in non-coding regions of the human genome by entering ...</h4></div>
                <div className="data-types-block" onClick={this.handleInfo}>
                    <h4 id="data-type-0"><i className="icon icon-caret-right" /> dbSNP IDs</h4>
                    <p className="data-type-explanation" id="data-explanation-0">Enter dbSNP ID(s) (example) or upload a list of dbSNP IDs to identify DNA features and regulatory elements that contain the coordinate of the SNP(s).</p>
                    <h4 id="data-type-1"><i className="icon icon-caret-right" /> Single nucleotides</h4>
                    <p className="data-type-explanation" id="data-explanation-1">Enter hg19 coordinates for a single nucleotide as 0-based (example) coordinates or in a BED file (example), VCF file (example), or GFF3 file (example). These coordinates will be mapped to a dbSNP IDs (if available) in addition to identifying DNA features and regulatory elements that contain the input coordinate(s).</p>
                    <h4 id="data-type-2"><i className="icon icon-caret-right" /> A chromosomal region</h4>
                    <p className="data-type-explanation" id="data-explanation-2">Enter hg19 chromosomal regions, such as a promoter region upstream of a gene, as 0-based (example) coordinates or in a BED file (example) or GFF3 file (example). All dbSNP IDs with an allele frequency >1% that are found in this region will be used to identify DNA features and regulatory elements that contain the coordinate of the SNP(s).</p>
                </div>
            </div>
        )
    }
}

DataTypes.propTypes = {
    handleInfo: PropTypes.func,
};


class AdvSearch extends React.Component {
    constructor() {
        super();

        // Set intial React state.
        /* eslint-disable react/no-unused-state */
        // Need to disable this rule because of a bug in eslint-plugin-react.
        // https://github.com/yannickcr/eslint-plugin-react/issues/1484#issuecomment-366590614
        this.state = {
            disclosed: false,
            showAutoSuggest: false,
            searchTerm: '',
            coordinates: '',
            genome: '',
            terms: {},
        };
        /* eslint-enable react/no-unused-state */

        // Bind this to non-React methods.
        this.handleDiscloseClick = this.handleDiscloseClick.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleAutocompleteClick = this.handleAutocompleteClick.bind(this);
        this.handleAssemblySelect = this.handleAssemblySelect.bind(this);
        this.closeAutocompleteBox = this.closeAutocompleteBox.bind(this);
        this.tick = this.tick.bind(this);
    }

    componentDidMount() {
        // Use timer to limit to one request per second
        this.timer = setInterval(this.tick, 1000);

        // const sequenceData = ['AGATCGACCCT',
        //     'GGAACGACGCT',
        //     'GGATCGACCCT',
        //     'CGATAGACGCT',
        //     'CGATAGACGCT',
        //     'GGATCGACCCT'];
        //
        // const seqLenBounds = [5, 25];
        // const seqNumBounds = [1, 10];
        // const seqSelector = '#sequence-logo';
        //
        // entryPoint(sequenceData, seqLenBounds, seqNumBounds, seqSelector);
    }

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    handleDiscloseClick() {
        this.setState(prevState => ({
            disclosed: !prevState.disclosed,
        }));
    }

    handleChange(e) {
        this.setState({ showAutoSuggest: true, terms: {} });
        this.newSearchTerm = e.target.value;
    }

    handleAutocompleteClick(term, id, name) {
        const newTerms = {};
        const inputNode = this.annotation;
        inputNode.value = term;
        newTerms[name] = id;
        this.setState({ terms: newTerms, showAutoSuggest: false });
        inputNode.focus();
        // Now let the timer update the terms state when it gets around to it.
    }

    handleAssemblySelect(event) {
        // Handle click in assembly-selection <select>
        this.setState({ genome: event.target.value });
    }

    closeAutocompleteBox() {
        this.setState({ showAutoSuggest: false });
    }

    tick() {
        if (this.newSearchTerm !== this.state.searchTerm) {
            this.setState({ searchTerm: this.newSearchTerm });
        }
    }

    render() {
        const context = this.props.context;
        const id = url.parse(this.context.location_href, true);
        const region = id.query.region || '';
        const genomeAssembly = context.title.startsWith('Regulome') ? regulomeGenomes : regionGenomes;

        console.log(this.state.genome);

        if (this.state.genome === '') {
            this.setState({ genome: context.assembly || genomeAssembly[0].value });
        }

        return (
            <Panel>
                <PanelBody>
                    <form id="panel1" className="adv-search-form" autoComplete="off" aria-labelledby="tab1" onSubmit={this.closeAutocompleteBox} >
                        <input type="hidden" name="annotation" value={this.state.terms.annotation} />
                        <div className="form-group">
                            <label htmlFor="annotation">Search dbSNP IDs, 0-based coordinates, BED files, VCF files, or GFF3 files (hg19)</label>
                            <div className="input-group input-group-region-input">
                                <input id="annotation" ref={(input) => { this.annotation = input; }} defaultValue={region} name="region" type="text" className="form-control" onChange={this.handleChange} placeholder="Enter search parameters here."/>
                                {(this.state.showAutoSuggest && this.state.searchTerm) ?
                                    <FetchedData loadingComplete>
                                        <Param name="auto" url={`/suggest/?genome=${this.state.genome}&q=${this.state.searchTerm}`} type="json" />
                                        <AutocompleteBox name="annotation" userTerm={this.state.searchTerm} handleClick={this.handleAutocompleteClick} />
                                    </FetchedData>
                                : null}
                                <div className="input-group-addon input-group-select-addon">
                                    <select value={this.state.genome} name="genome" onFocus={this.closeAutocompleteBox} onChange={this.handleAssemblySelect}>
                                        {genomeAssembly.map(genomeId =>
                                            <option key={genomeId.value} value={genomeId.value}>{genomeId.display}</option>
                                        )}
                                    </select>
                                </div>
                                {(context.notification && this.state.searchTerm !== "" && this.state.searchTerm !== undefined) ?
                                    <p className="input-region-error">{context.notification}</p>
                                : null}
                            </div>
                        </div>
                        <input type="submit" value="Search" className="btn btn-sm btn-info pull-right" />
                    </form>
                    {(context.coordinates && this.state.searchTerm !== "") ?
                        <p>Searched coordinates: <strong>{context.coordinates}</strong></p>
                    : null}
                    {(context.regulome_score && this.state.searchTerm !== "") ?
                        <p><strong>RegulomeDB score: {context.regulome_score}</strong></p>
                    : null}
                </PanelBody>
            </Panel>
        );
    }
}

AdvSearch.propTypes = {
    context: PropTypes.object.isRequired,
};

AdvSearch.contextTypes = {
    autocompleteTermChosen: PropTypes.bool,
    autocompleteHidden: PropTypes.bool,
    onAutocompleteHiddenChange: PropTypes.func,
    location_href: PropTypes.string,
};

// class SequenceLogo extends React.Component {
//     render (){
//         return (
//             <div className="sequence-logo-container">
//                 <div id="sequence-logo" className="sequence-logo"></div>
//             </div>
//         );
//     }
// }

class RegulomeSearch extends React.Component {
    constructor() {
        super();

        // Bind this to non-React methods.
        this.onFilter = this.onFilter.bind(this);
    }

    onFilter(e) {
        if (this.props.onChange) {
            const search = e.currentTarget.getAttribute('href');
            this.props.onChange(search);
            e.stopPropagation();
            e.preventDefault();
        }
    }

    render() {
        const visualizeLimit = 100;
        const context = this.props.context;
        const results = context['@graph'];
        const columns = context.columns;
        const notification = context.notification;
        const searchBase = url.parse(this.context.location_href).search || '';
        const trimmedSearchBase = searchBase.replace(/[?|&]limit=all/, '');
        const filters = context.filters;
        const facets = context.facets;
        const total = context.total;
        const visualizeDisabled = total > visualizeLimit;

        // Get a sorted list of batch hubs keys with case-insensitive sort
        let visualizeKeys = [];
        if (context.visualize_batch && Object.keys(context.visualize_batch).length) {
            visualizeKeys = Object.keys(context.visualize_batch).sort((a, b) => {
                const aLower = a.toLowerCase();
                const bLower = b.toLowerCase();
                return (aLower > bLower) ? 1 : ((aLower < bLower) ? -1 : 0);
            });
        }

        return (
            <div>
                <div className="lead-logo"><img src="/static/img/RegulomeLogoFinal.gif"></img></div>

                <AdvSearch {...this.props} />
                {notification.startsWith('Success') ?
                    <div className="panel data-display main-panel">
                        <div className="row">
                            <div className="col-sm-5 col-md-4 col-lg-3">
                                <FacetList
                                    {...this.props}
                                    facets={facets}
                                    filters={filters}
                                    searchBase={searchBase ? `${searchBase}&` : `${searchBase}?`}
                                    onFilter={this.onFilter}
                                />
                            </div>
                            <div className="col-sm-7 col-md-8 col-lg-9">
                                <div>
                                    <h4>
                                        Showing {results.length} of {total}
                                    </h4>
                                    <div className="results-table-control">
                                        {total > results.length && searchBase.indexOf('limit=all') === -1 ?
                                                <a
                                                    rel="nofollow"
                                                    className="btn btn-info btn-sm"
                                                    href={searchBase ? `${searchBase}&limit=all` : '?limit=all'}
                                                    onClick={this.onFilter}
                                                >
                                                    View All
                                                </a>
                                        :
                                            <span>
                                                {results.length > 25 ?
                                                        <a
                                                            className="btn btn-info btn-sm"
                                                            href={trimmedSearchBase || '/regulome-search/'}
                                                            onClick={this.onFilter}
                                                        >
                                                            View 25
                                                        </a>
                                                : null}
                                            </span>
                                        }

                                        {visualizeKeys && context.visualize_batch ?
                                            <BrowserSelector
                                                visualizeCfg={context.visualize_batch}
                                                disabled={visualizeDisabled}
                                                title={visualizeDisabled ? `Filter to ${visualizeLimit} to visualize` : 'Visualize'}
                                            />
                                        : null}

                                    </div>
                                </div>

                                <hr />
                                <ul className="nav result-table" id="result-table">
                                    {results.map(result => Listing({ context: result, columns, key: result['@id'] }))}
                                </ul>
                            </div>
                        </div>
                    </div>
                : null}
                <DataTypes />

            </div>
        );
    }
}

RegulomeSearch.propTypes = {
    context: PropTypes.object.isRequired,
    onChange: PropTypes.func,
};

RegulomeSearch.defaultProps = {
    onChange: null,
};

RegulomeSearch.contextTypes = {
    location_href: PropTypes.string,
    navigate: PropTypes.func,
};

globals.contentViews.register(RegulomeSearch, 'regulome-search');
// globals.contentViews.register(RegulomeSearch, 'region-search');
