import React from 'react';
import PropTypes from 'prop-types';


const maxFilesBrowsed = 40; // Maximum number of files to browse
const domainName = 'https://www.encodeproject.org';
const dummyFiles = [
    {
        file_format: 'bigWig',
        output_type: 'minus strand signal of all reads',
        accession: 'ENCFF425LKJ',
        href: '/files/ENCFF425LKJ/@@download/ENCFF425LKJ.bigWig',
    },
    {
        file_format: 'bigWig',
        output_type: 'plus strand signal of all reads',
        accession: 'ENCFF638QHN',
        href: '/files/ENCFF638QHN/@@download/ENCFF638QHN.bigWig',
    },
    {
        file_format: 'bigWig',
        output_type: 'plus strand signal of unique reads',
        accession: 'ENCFF541XFO',
        href: '/files/ENCFF541XFO/@@download/ENCFF541XFO.bigWig',
    },
    // {
    //     file_format: 'bigBed',
    //     output_type: 'transcription start sites',
    //     accession: 'ENCFF517WSY',
    //     href: '/files/ENCFF517WSY/@@download/ENCFF517WSY.bigBed',
    // },
    // {
    //     file_format: 'bigBed',
    //     output_type: 'peaks',
    //     accession: 'ENCFF026DAN',
    //     href: '/files/ENCFF026DAN/@@download/ENCFF026DAN.bigBed',
    // },
    // {
    //     file_format: 'bigBed',
    //     output_type: 'peaks',
    //     accession: 'ENCFF847CBY',
    //     href: '/files/ENCFF847CBY/@@download/ENCFF847CBY.bigBed',
    // },
];


function rAssemblyToSources(assembly, region) {
    const browserCfg = {
        chr: '22',
        viewStart: 29890000,
        viewEnd: 30050000,
        sources: [],
        positionSet: false,
    };

    if (region) {
        // console.log('region provided: %s', region);
        const reg = region.split(':');
        browserCfg.chr = reg[0].substring(3, reg[0].length);
        const positions = reg[1].split('-');
        for (let i = 0; i < positions.length; i += 1) {
            positions[i] = parseInt(positions[i].replace(/,/g, ''), 10);
        }
        if (positions.length > 1) {
            if (positions[0] > 10000) {
                browserCfg.viewStart = positions[0] - 10000;
            } else {
                browserCfg.viewStart = 1;
            }
            browserCfg.viewEnd = positions[1] + 10000;
        } else {
            if (positions[0] > 10000) {
                browserCfg.viewStart = positions[0] - 10000;
            } else {
                browserCfg.viewStart = 1;
            }
            browserCfg.viewEnd = positions[0] + 10000;
        }
        browserCfg.positionSet = true;
    }

    if (assembly === 'GRCh38') {
        // sources:
        // Genome: faToTwoBit GRCh38_no_alt_analysis_set_GCA_000001405.15.fa.gz
        // gencode: http://ngs.sanger.ac.uk/production/gencode/trackhub/data/gencode.v24.annotation.bb
        // repeats: http://www.biodalliance.org/datasets/GRCh38/repeats.bb
        browserCfg.cookieKey = 'GRCh38';
        browserCfg.coordSystem = { speciesName: 'Homo sapiens', taxon: 9606, auth: 'GRCh', version: 38, ucscName: 'hg38' };
        browserCfg.sources = [
            {
                name: 'Genome',
                desc: 'Human reference genome build GRCh38/hg38 (GRCh38_no_alt_analysis_set_GCA_000001405.15)',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/GRCh38/GRCh38_no_alt_analysis_set_GCA_000001405.15.2bit',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'GENCODE',
                desc: 'Gene structures from GENCODE v24',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/GRCh38/gencode.v24.annotation.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/GRCh38/gencode2_v24.xml',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/GRCh38/gencode.v24.annotation.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from RepeatMasker',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/GRCh38/repeats_GRCh38.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/GRCh38/bb-repeats2_GRCh38.xml',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'hg19') {
        // sources:
        // Genome: faToTwoBit male.hg19.fa.gz
        // gencode: http://ngs.sanger.ac.uk/production/gencode/trackhub/data/gencode.v19.annotation.bb
        // repeats: http://www.biodalliance.org/datasets/GRCh38/repeats.bb
        browserCfg.cookieKey = 'GRCh37';
        browserCfg.coordSystem = { speciesName: 'Homo sapiens', taxon: 9606, auth: 'GRCh', version: 37, ucscName: 'hg19' };
        browserCfg.sources = [
            {
                name: 'Genome',
                desc: 'Human reference genome build GRCh37/hg19',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/hg19/male.hg19.2bit',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'GENCODE',
                desc: 'Gene structures from GENCODE v19',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/hg19/gencode.v19.annotation.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/hg19/gencode_v19.xml',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/hg19/gencode.v19.annotation.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from RepeatMasker',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/hg19/repeats_hg19.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/hg19/bb-repeats_hg19.xml',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'mm10' || assembly === 'mm10-minimal') {
        if (!browserCfg.positionSet) {
            browserCfg.chr = '19';
            browserCfg.viewStart = 30000000;
            browserCfg.viewEnd = 30100000;
        }
        browserCfg.cookieKey = 'GRCm38';
        browserCfg.coordSystem = { speciesName: 'Mus musculus', taxon: 10090, auth: 'GRCm', version: 38, ucscName: 'mm10' };
        // sources:
        // Genome: faToTwoBit mm10_no_alt_analysis_set_ENCODE.fa.gz
        // gencode: http://ngs.sanger.ac.uk/production/gencode/trackhub/data/gencode.vM4.annotation.bb
        // repeats: http://www.biodalliance.org/datasets/GRCm38/repeats.bb
        browserCfg.sources = [
            {
                name: 'Genome',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm10/mm10_no_alt_analysis_set_ENCODE.2bit',
                desc: 'Mouse reference genome build GRCm38',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'Genes',
                desc: 'Gene structures from GENCODE M4',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm10/gencode.vM4.annotation.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm10/gencode_vM4.xml',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm10/gencode.vM4.annotation.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from UCSC',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm10/repeats_mm10.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm10/bb-repeats2_mm10.xml',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'mm9') {
        // sources:
        // Genome: http://hgdownload.soe.ucsc.edu/goldenPath/mm10/bigZips/mm10.2bit
        // gencode: ftp://ftp.sanger.ac.uk/pub/gencode/Gencode_mouse/release_M1/gencode.vM1.annotation.gtf.gz
        // repeats: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Mammal, genome: mouse, assembly: mm9, group: variation and repeats, track: repeatmaster)
        if (!browserCfg.positionSet) {
            browserCfg.chr = '19';
            browserCfg.viewStart = 30000000;
            browserCfg.viewEnd = 30030000;
        }
        browserCfg.cookieKey = 'NCBIM37';
        browserCfg.coordSystem = { speciesName: 'Mus musculus', taxon: 10090, auth: 'NCBIM', version: 37 };
        browserCfg.sources = [
            {
                name: 'Genome',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm9/mm9.2bit',
                desc: 'Mouse reference genome build NCBIm37',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'Genes',
                desc: 'Gene structures from GENCODE M1',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm9/gencode.vM1.annotation.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm9/gencode_vM1.xml',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm9/gencode.vM1.annotation.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from UCSC',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm9/repeats_mm9.bb',
                stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/mm9/bb-repeats_mm9.xml',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'dm6') {
        // sources:
        // Genome: from http://hgdownload.cse.ucsc.edu/goldenPath/dm6/bigZips/dm6.2bit
        // annotations: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Insect, genome: D. melanogaster, assembly: dm6, group: Genes and Gene Predictions, track: RefSeq Genes)
        // repeats: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Insect, genome: D. melanogaster, assembly: dm6, group: variation and repeats, track: repeatmaster)
        if (!browserCfg.positionSet) {
            browserCfg.chr = '3L';
            browserCfg.viewStart = 15940000;
            browserCfg.viewEnd = 15985000;
        }
        browserCfg.cookieKey = 'BDGP6';
        browserCfg.coordSystem = { speciesName: 'Drosophila melanogaster', taxon: 7227, auth: 'BDGP', version: 6 };
        browserCfg.sources = [
            {
                name: 'Genome',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/dm6.2bit',
                desc: 'D. melanogaster reference genome build BDGP R6/dm6',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'Genes',
                desc: 'Gene structures from UCSC BDGP6 + ISO1 MT/dm6',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/dm6_UCSC_RefSeq_track.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/dm6_UCSC_RefSeq_track.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from UCSC',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/repeats_dm6.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'dm3') {
        // sources:
        // Genome: from http://hgdownload.cse.ucsc.edu/goldenPath/dm3/bigZips/dm3.2bit
        // annotations: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Insect, genome: D. melanogaster, assembly: dm3, group: Genes and Gene Predictions, track: RefSeq Genes)
        // repeats: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Insect, genome: D. melanogaster, assembly: dm3, group: variation and repeats, track: repeatmaster)
        if (!browserCfg.positionSet) {
            browserCfg.chr = '3L';
            browserCfg.viewStart = 15940000;
            browserCfg.viewEnd = 15985000;
        }
        browserCfg.cookieKey = 'BDGP5';
        browserCfg.coordSystem = { speciesName: 'Drosophila melanogaster', taxon: 7227, auth: 'BDGP', version: 5 };
        browserCfg.sources = [
            {
                name: 'Genome',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm3/dm3.2bit',
                desc: 'D. melanogaster reference genome build BDGP R5/dm3',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'Genes',
                desc: 'Gene structures from UCSC BDGP R5/dm3',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm3/dm3_UCSC_RefSeq_track.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm6/',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm3/dm3_UCSC_RefSeq_track.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from UCSC',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm3/repeats_dm3.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/dm3/',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'ce11') {
        // sources:
        // Genome: from http://hgdownload.soe.ucsc.edu/goldenPath/ce11/bigZips/ce11.2bit
        // annotations: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Nematode, genome: C. elegans, assembly: ce11/WBcel235, group: Genes and Gene Predictions, track: RefSeq Genes)
        // repeats: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Nematode, genome: C. elegans, assembly: ce11/WBcel235, group: variation and repeats, track: repeatmaster)
        if (!browserCfg.positionSet) {
            browserCfg.chr = 'II';
            browserCfg.viewStart = 14646376;
            browserCfg.viewEnd = 14667875;
        }
        browserCfg.cookieKey = 'WBcel235';
        browserCfg.coordSystem = { speciesName: 'Caenorhabditis elegans', taxon: 6239, auth: 'WBcel', version: 235 };
        browserCfg.sources = [
            {
                name: 'Genome',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce11/ce11.2bit',
                desc: 'C. elegans reference genome build ce11/WBcel235',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'Genes',
                desc: 'Gene structures from UCSC ce11/WBCel235',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce11/ce11_UCSC_RefSeq_track.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce11/',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce11/ce11_UCSC_RefSeq_track.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from UCSC',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce11/repeats_ce11.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce11/',
                forceReduction: -1,
            },
        ];
    } else if (assembly === 'ce10') {
        // sources:
        // Genome: from http://hgdownload.soe.ucsc.edu/goldenPath/ce10/bigZips/ce10.2bit
        // annotations: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Nematode, genome: C. elegans, assembly: ce10/WS220, group: Genes and Gene Predictions, track: RefSeq Genes)
        // repeats: http://genome.ucsc.edu/cgi-bin/hgTables?command=start (clade: Nematode, genome: C. elegans, assembly: ce10/WS220, group: variation and repeats, track: repeatmaster)
        if (!browserCfg.positionSet) {
            browserCfg.chr = 'II';
            browserCfg.viewStart = 14646376;
            browserCfg.viewEnd = 14667875;
        }
        browserCfg.cookieKey = 'WS220';
        browserCfg.coordSystem = { speciesName: 'Caenorhabditis elegans', taxon: 6239, auth: 'WS', version: 220 };
        browserCfg.sources = [
            {
                name: 'Genome',
                twoBitURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce10/ce10.2bit',
                desc: 'C. elegans reference genome build ce10/WS220',
                tier_type: 'sequence',
                provides_entrypoints: true,
                pinned: true,
            },
            {
                name: 'Genes',
                desc: 'Gene structures from UCSC ce10/WS220',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce10/ce10_UCSC_RefSeq_track.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce10/',
                collapseSuperGroups: true,
                trixURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce10/ce10_UCSC_RefSeq_track.ix',
            },
            {
                name: 'Repeats',
                desc: 'Repeat annotation from UCSC',
                bwgURI: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce10/repeats_ce10.bb',
                // stylesheet_uri: 'https://s3-us-west-1.amazonaws.com/encoded-build/browser/ce10/',
                forceReduction: -1,
            },
        ];
    }
    return browserCfg;
}


class GenomeBrowser extends React.Component {
    constructor(props, context) {
        super(props, context);
        
        this.state = {
            width: 592,
            height: 1000,
            trackList: [],
        };
        
        this.drawTracks = this.drawTracks.bind(this);
        this.drawTracksResized = this.drawTracksResized.bind(this);

    }
    
    drawTracks(container) {
        let visualizer = new GenomeVisualizer({tracks: this.state.trackList});
        
        console.log(this.state.trackList);
        visualizer.render({
            width: this.state.width,
            height: this.state.height
        }, container);
    }
    
    drawTracksResized() {
        console.log("resize");
        
        this.setState({
            width: this.chartdisplay.clientWidth,
            height: this.chartdisplay.clientHeight
        });
        if (this.chartdisplay){
            const container = this.chartdisplay;
            this.drawTracks(container);
        }
    }
    
    componentDidMount(){
        
        const { assembly, region, limitFiles } = this.props;
        // console.log('DidMount ASSEMBLY: %s', assembly);

        // Probably not worth a define in globals.js for visualizable types and statuses.
        // Extract only bigWig and bigBed files from the list:
        let files = this.props.files.filter(file => file.file_format === 'bigWig' || file.file_format === 'bigBed');
        files = files.filter(file => ['released', 'in progress', 'archived'].indexOf(file.status) > -1);

        console.log("is this a variable that we have");
        console.log(maxFilesBrowsed);
        console.log(limitFiles);
        
        let domain = `${window.location.protocol}//${window.location.hostname}`;
        if (domain.includes('localhost')) {
            domain = domainName;
            // Make some fake file objects from "test" just to give the genome browser something to
            // chew on if we're running locally.
            files = dummyFiles;
        } else {
            files = limitFiles ? files.slice(0, maxFilesBrowsed - 1) : files;
        }
        
        // let tracks = files.map(file => {
        //     return domain+file.href;
        // });
        
        let tracks = files.map(file => {
            let trackObj = {};
            trackObj['name'] = file.accession;
            trackObj['type'] = 'signal';
            trackObj['path'] = domain+file.href;
            trackObj['heightPx'] = 100;
            return trackObj;
        });
        
        // let tracks = [
        //     {
        //         name: 'DNA',
        //         type: 'sequence',
        //         path: 'https://s3-us-west-1.amazonaws.com/valis-file-storage/genome-data/GRCh38.vdna-dir',
        //     },
        //     {
        //         name: 'Genes',
        //         type: 'annotation',
        //         compact: true,
        //         path: 'https://s3-us-west-1.amazonaws.com/valis-file-storage/genome-data/GRCh38.92.vgenes-dir',
        //     },
        //     {
        //         name: 'Cerebellum, DNase',
        //         type: 'signal',
        //         path: "https://www.encodeproject.org/files/ENCFF833POA/@@download/ENCFF833POA.bigWig",
        //         heightPx: 150,
        //     },
        // ]
        
        console.log(tracks);
            
        this.setState({trackList: tracks}, function () {
            if (this.chartdisplay) {
                
                this.setState({
                    width: this.chartdisplay.clientWidth,
                }, function(){
                    this.drawTracks(this.chartdisplay);
                    window.addEventListener("resize", this.drawTracksResized);
                });
                
            }
        });

    }

    render() {
        return (
            <div>
                <div ref={(div) => { this.chartdisplay = div; }} className="valis-browser" />
            </div>
        );
    }
}

GenomeBrowser.propTypes = {
    height: React.PropTypes.number,
    width: React.PropTypes.number,
    trackList: React.PropTypes.array,
};

GenomeBrowser.defaultProps = {
    height: 0,
    width: 0,
    trackList: [],
};

export default GenomeBrowser;
