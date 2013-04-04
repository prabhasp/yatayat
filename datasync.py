# Python script to download data from overpass
# 
# It is designed to run unsupervised as a cron job, and to send
# e-mails when changes to the data cause dataquality warnings.
# 

import argparse
import json
import subprocess
import shutil
import urllib2

def email(address, errors):
    msg = """To: %s
From: Yatayat Sanity Bot <yatayat@NUMM.ORG>
Subject: [yatayat-QC] Errors found in today's Overpass data

%s
""" % (address, errors)
    p = subprocess.Popen(["/usr/sbin/sendmail", address],
                     stdin=subprocess.PIPE)
    p.stdin.write(msg)
    p.stdin.close()
    p.wait()

def push(files):
    ret = subprocess.call(["git", "commit", "-m", "datasync: overpass files updated"] + files)
    if ret == 0:
        subprocess.call(["git", "push"])

def parse_args():
    parser = argparse.ArgumentParser(description="synchronize osm data through the overpass API")
    parser.add_argument("--address",
                        default="yatayat@NUMM.ORG",
                        help="address to email with errors")
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

    if len(err.strip()) > 0 and not opts.force:
        # There were errors
        if not opts.silent:
            email(opts.address, err)
            # only push experimental
            push([opts.experimental])
    else:
        # Copy "experimental" to "stable"
        shutil.copy(opts.experimental, opts.stable)
        if not opts.silent:
            push([opts.experimental, opts.stable])

if __name__=='__main__':
    run()
