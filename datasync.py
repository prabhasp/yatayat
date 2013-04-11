# Python script to download data from overpass
# 
# It is designed to run unsupervised as a cron job, and to send
# e-mails when changes to the data cause dataquality warnings.
# 

import argparse
import json
import os
import subprocess
import shutil
import sys
import urllib2

def email(address, errors, subject="QC Errors found in today's Overpass data"):
    msg = """To: %s
From: Yatayat Sanity Bot <yatayat@NUMM.ORG>
Subject: %s

%s
""" % (address, subject, errors)
    p = subprocess.Popen(["/usr/lib/sendmail", '--', address],
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
    # Change CWD to location of this script
    os.chdir(os.path.dirname(__file__))

    opts = parse_args()

    conf = json.load(opts.config)

    # Download latest data from overpass
    if not opts.no_overpass:
        open(opts.experimental, 'w').write(
            urllib2.urlopen(conf["API_URL"], data=conf["QUERY_STRING"]).read())

    NODE = 'nodejs'              # debian
    if sys.platform == 'darwin': # osx
        NODE = 'node'

    # Check data for quality errors
    p = subprocess.Popen([NODE, "cli_dataquality.js", opts.experimental],
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    err = p.stdout.read()
    stderr = p.stderr.read()
    if len(stderr.strip()) > 0 and not opts.force:
        # code-wise errors (!)
        if not opts.silent:
            email(opts.address, stderr, subject="URGENT JS ERRORS IN YATAYAT")
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
