Yatayat
--
Kathmandu Public Transport

Openstreetmap-based point-to-point routing, developed for Kathmandu.

## HACKING / DEPLOYING

### submodules
yatayat uses a kdtree implementation from @ubilabs on github; to
use it you will need to run

```sh
% git submodule init
% git submodule update
```

inside your cloned repository

### config
config.js pulls from a overpass-api directly; to develop locally, 
you can symlink config.local.js to config.js, but please be
careful not to commit your symlinked file

```sh
% ln -s config.local.js config.js
```

## Data Model
OSM Data is transformed into Routes, Stops, and Segments:

### Route:
 -  id
 -  name
 -  ref           // route number
 -  transport     // type of transport; pulled from tag.type
 -  stops: []     // are ordered
 -  stopDict: {}  // indexed by id
 -  segments: []
 -  tag: {}

### Stop:
 - id
 - name
 - lat
 - lng
 - tag: {}

### Segment:
 - listOfLatLng: [(lat,lng), ...]
 - tag: {}

## CLI

There are commandline tools for verifying data quality.

These make use of nodejs. On Debian-based systems,
all external dependencies can be installed via APT:

```sh
% apt-get install nodejs node-jquery node-underscore
```

Elsewhere, you can try your luck with NPM:

```sh
% npm install jquery underscore
```

Then, you can run:

```sh
% nodejs cli_dataquality.js
```