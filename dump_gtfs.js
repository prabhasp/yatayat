#!/usr/bin/env nodejs

var YY = require('./yatayat.js');
var GTFO = require('./GTFO.js');

var fs = require("fs");

var USAGE = "./dump_gtfs.js OVERPASS.xml"

var AGENCIES = [
    {name: "Microbus", filter: "bus", url: "http://yatayat.monsooncollective.org/#agency:micro"},
    {name: "Tempo", filter: "tempo", url: "http://yatayat.monsooncollective.org/#agency:tempo"}
];

// Get "system" -- assumes that overpass XML is stored locally
if(process.argv.length < 3) {
    console.log(USAGE);
    throw "dump_gtfs requires path to XML data";
}

// Load system as YY.System
var system = YY.fromOSM(fs.readFileSync(process.argv[2], "utf-8"));

AGENCIES.forEach(function(agency) {
    var gtfo = new GTFO(system, agency);
    var csvs = gtfo.generate_csvs();

    for(var key in csvs) {
        fs.writeFileSync(agency.name + "-" + key + ".txt", csvs[key]);
    }
});
