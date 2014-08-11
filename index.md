---
layout: page
title: Word Luck 
tagline: Enjoy words and have a good luck for you!
---
{% include JB/setup %}

<div class="container">
 {% for post in site.posts %}
 <div class="post">
  <h1><a href="{{ site.baseurl }}{{ post.url }}" title="{{ post.title }}">{{ post.title }}</a></h1>
  <div class="row">
   <div class="col-xs-2"><p class="text-right">Posted at:</p></div>
   <div class="col-xs-10"><p class="text-left">{{ post.date | date_to_long_string }}</p></div>
  </div>
  <div class="row">
   <div class="col-xs-2"><p class="text-right">Abstract:</p></div>
   <div class="col-xs-10">
   <div>
   {% if post.abstrat %}
   {{ post.abstrat }}
   {% else %}
   {{ post.content | truncatewords:20 }}</p>
   {% endif %}
   </div>
   <a class="btn btn-link" title="{{ post.title }}" href="{{ site.baseurl }}{{ post.url }}">Read More</a>
   </div>
 </div>
 {% endfor %}
</div>


