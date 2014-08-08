---
layout: post
tagline: "jekyll"
tags : [jekyll,jekyll-bootstrap,github pages]
---
{% include JB/setup %}

This is the website of Huo Linhe hosted as github pages at
[wordluck.github.io](http://wordluck.github.io).

The flowings complete all the hosting stuff.

## Github Pages

[Github Pages](https://pages.github.com/) are public web pages for users,
organizations, and repositories, that are freely hosted on GitHub’s 
`github.io` domain or on a custom domain name of your choice. GitHub Pages
are powered by [Jekyll](http://jekyllrb.com/) behind the scenes, so in 
addition to supporting regular HTML content, they’re also a great way to 
host your Jekyll-powered website for free.

### wordluck.github.io

Github pages are avaliable for `username.github.io`, `orgnazationname.github.io`,
or `*.github.io/projectname`. In my website, I will use a orgnazation name to 
host my blog.

## Jykell

[Jekyll](http://jekyllrb.com) will transform plain text into static websites and blog.
Websites could work fine in localhost or github.

To run a website in local computer, just type:

    $ gem install jekyll
    $ jekyll new a-new-website
    $ cd a-new-website 
    $ jekyll serve
    # now browse to http://localhost:4000 to local website

Jekyll in different port:
    
    $ jekyll serve --port 4002

## Hosting

Creating the `wordluck.github.io` project and push the jekyll website to 
github repository.

    git remote add origin https://github.com/wordluck/wordluck.github.io.git

After serveral minutes, the website will be created.




