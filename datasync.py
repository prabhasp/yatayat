# Python script to download data from overpass
# 
# It is designed to run unsupervised as a cron job, and to send
# e-mails when changes to the data cause dataquality warnings.
# 

import argparse
import json
import subprocess
import os
import urllib2

def parse_args():
    parser = argparse.ArgumentParser(description="synchronize osm data through the overpass API")
    parser.add_argument("--config",
                        default="config.overpass.json",
                        type=argparse.FileType('r'),
                        help="JSON config file")
    parser.add_argument("--experimental",
                        default="transit.experimental.xml",
                        help="Where to download latest overpass data")
    parser.add_argument("--stable",
                        default="transit.stable.xml",
                        help="Where to put overpass data, if stable")
    parser.add_argument("--no-overpass",
                        default=False,
                        action="store_true",
                        help="Don't download from overpass")
    parser.add_argument("--force",
                        default=False,
                        action="store_true",
                        help="overwrite 'stable' even if tests fail")
    parser.add_argument("--silent",
                        default=False,
                        action="store_true",
                        help="suppresses git or e-mail outputs")
    return parser.parse_args()

def run():
    opts = parse_args()
    conf = json.load(opts.config)

    # Download latest data from overpass
    if not opts.no_overpass:
        open(opts.experimental, 'w').write(
            urllib2.urlopen(conf["API_URL"], data=conf["QUERY_STRING"]).read())

    # Check data for quality errors
    p = subprocess.Popen(["./cli_dataquality.js", opts.experimental],
                         stdout=subprocess.PIPE)
    err = p.stdout.read()
    print err

if __name__=='__main__':
    run()
