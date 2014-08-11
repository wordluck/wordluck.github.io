---
layout: post
title: QtCreator: module QtQuick is not installed
abstrat: Solution for QtCreator front-end error shown - fix error: module "QtQuick" is not installed
tagline: "qt"
tags : [qt,qtcreator]
---
{% include JB/setup %}

When first open QtCreator, its first page shown in the front-end is empty -
not the regular opened sessions selector.

I tried to run it from the terminal, it shows the error:

> file:///usr/share/qtcreator/welcomescreen/welcomescreen.qml:30:1:
> module “QtQuick” is not installed
> > import QtQuick 2.1

# Solution

```bash
sudo apt-get install qtdeclarative5-qtquick2-plugin
```

Problem resoved.

