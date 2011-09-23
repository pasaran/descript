#!/usr/bin/perl

use strict;
use warnings;

# NOTE: required Crypt::SSLeay

use LWP::Simple;
use File::Basename;
use LWP::UserAgent;
use File::Path qw( make_path );

my $exts;
my $F;
open($F, '.externals') or die "Cannot open '.externals'.";
{
    local $/;
    $exts = <$F>;
}
close($F);

my @lines = grep { !(/^#/ || /^\s*$/); } split(/\n/, $exts);

for my $line (@lines) {
    my ($path, $url, $ver) = split(/\s+/, $line);

    my ($basename, $dirname, $extname) = fileparse($path, qr/\.[^.]*/);

    if (-e $path) {
        if (-l $path) {
            unlink($path);
        } else {
            die "$path should be a symlink.";
        }
    }

    my $ua = LWP::UserAgent->new;
    my $response = $ua->get($url);
    if ($response->is_success) {
        my $content = $response->content;

        if (!(-d $dirname)) {
            make_path($dirname);
        }

        my $vername = "$basename-${ver}$extname";

        my $F;
        open($F, ">${dirname}$vername");
        print $F $content;
        close($F);

        symlink($vername, "${dirname}${basename}$extname");
    } else {
        die "Cannot open $url.";
    }
}

