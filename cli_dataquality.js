var yy = require('./yatayat.js');
var conf = require('./config.js');
var DQ = require('./dataquality.js');

var fs = require("fs");

// Get "system" -- assumes that overpass XML is stored locally
if(conf.GET_OR_POST === "POST") {
    throw "cli_dataquality requires local XML data";
}

// Load system as YY.System
var system = yy(fs.readFileSync(conf.API_URL, "utf-8"));

// Run tests: this will be silent if there are no errors
console.log(DQ.findErrors(system));