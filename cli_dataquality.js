#!/usr/bin/env nodejs

var yy = require('./yatayat.js');
var DQ = require('./dataquality.js');

var fs = require("fs");

// Get "system" -- assumes that overpass XML is stored locally
if(process.argv.length !== 3) {
    throw "cli_dataquality requires path to XML data";
}

// Load system as YY.System
var system = yy(fs.readFileSync(process.argv[2], "utf-8"));

// Run tests: this will be silent if there are no errors
console.log(DQ.findErrors(system));