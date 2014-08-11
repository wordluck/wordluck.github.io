---
layout: post
title: Bind the github.io host with DotTK domains
abstrat: This is some experience for configuring a CNAME record with custom DNS provider
tagline: "jekyll"
tags : [jekyll,jekyll-bootstrap,github pages]
---
{% include JB/setup %}

In this part, I have direct the wordluck.tk domain to this blog.

# DotTK Domains

To register a TK domain, just login to [my.dot.tk](http://my.dot.tk), and add a **FREE** domain.

Free TK domains could be hosted freely in 12 months, and will be freely renewed before they gone down.

# Direct

As you add a domain in your dot.tk domain panel, you could just direct the domain to `yourname.github.io`. The domain will be avaliable in several minutes.

This will cause some warnings while building pages. Here in my website, I finnaly use dnspod for CNAME.

# Use DNSPOD

Directly alias the DotTK domain to `yourname.github.io` will cause warnings from github building:

> The page build completed successfully, but returned the following warning:
> 
> GitHub Pages recently underwent some improvements 
> (https://github.com/blog/1715-faster-more-awesome-github-pages) 
> to make your site faster and more awesome, but we've noticed that 
> `www.*.tk` isn't properly configured to take advantage of these new features. While your site will continue to work just fine, updating your domain's configuration offers some additional speed and performance benefits. Instructions on configuring a subdomain for use with GitHub Pages can be found at https://help.github.com/articles/setting-up-a-custom-domain-with-github-pages#subdomains, and of course, you can always get in touch with a human at support@github.com. For the more technical minded folks who want to skip the help docs: your site's CNAME record should point to `your-username.github.io`, but it does not. 
>
> For information on troubleshooting Jekyll see:
>
> https://help.github.com/articles/using-jekyll-with-pages#troubleshooting
>
> If you have any questions please contact us at https://github.com/contact.

## Setting up DNSpod in my.dot.tk

Open the domain panel for yourname.tk, and set the "Custom DNS" for DNSpod:

| Hostname | IP address |
| -------- | ---------- |
| f1g1ns1.dnspod.net | n/a |
| f1g1ns2.dnspod.net | n/a |

## Add TK domain to DNSpod

Login the [dnspod website](https://www.dnspod.cn/Domain), touch "Add domain".
Then Add the CNAME like:

| Hostname | Type | Value |
| -------- | ---- | ----- |
| @ | CNAME | www.wordluck.tk |
| www | CNAME | yourname.github.io |

## Add CNAME file to github repository

A CNAME file contains:

> www.yourname.tk

## The End

Enjoy!


