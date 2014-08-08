;(function() {

/**
 * Block-Level Grammar
 */

var block = {
  newline: /^\n+/,
  code: /^( {4}[^\n]+\n*)+/,
  fences: noop,
  hr: /^( *[-*_]){3,} *(?:\n+|$)/,
  heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
  nptable: noop,
  lheading: /^([^\n]+)\n *(=|-){3,} *\n*/,
  blockquote: /^( *>[^\n]+(\n[^\n]+)*\n*)+/,
  list: /^( *)(bull) [\s\S]+?(?:hr|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
  html: /^ *(?:comment|closed|closing) *(?:\n{2,}|\s*$)/,
  def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
  table: noop,
  paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
  text: /^[^\n]+/
};

block.bullet = /(?:[*+-]|\d+\.)/;
block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', /\n+(?=(?: *[-*_]){3,} *(?:\n+|$))/)
  ();

block._tag = '(?!(?:'
  + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
  + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
  + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|@)\\b';

block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

/**
 * Normal Block Grammar
 */

block.normal = merge({}, block);

/**
 * GFM Block Grammar
 */

block.gfm = merge({}, block.normal, {
  fences: /^ *(`{3,}|~{3,}) *(\S+)? *\n([\s\S]+?)\s*\1 *(?:\n+|$)/,
  paragraph: /^/
});

block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!' + block.gfm.fences.source.replace('\\1', '\\2') + '|')
  ();

/**
 * GFM + Tables Block Grammar
 */

block.tables = merge({}, block.gfm, {
  nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
  table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
});

/**
 * Block Lexer
 */

function Lexer(options) {
  this.tokens = [];
  this.tokens.links = {};
  this.options = options || marked.defaults;
  this.rules = block.normal;

  if (this.options.gfm) {
    if (this.options.tables) {
      this.rules = block.tables;
    } else {
      this.rules = block.gfm;
    }
  }
}

/**
 * Expose Block Rules
 */

Lexer.rules = block;

/**
 * Static Lex Method
 */

Lexer.lex = function(src, options) {
  var lexer = new Lexer(options);
  return lexer.lex(src);
};

/**
 * Preprocessing
 */

Lexer.prototype.lex = function(src) {
  src = src
    .replace(/\r\n|\r/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\u00a0/g, ' ')
    .replace(/\u2424/g, '\n');

  return this.token(src, true);
};

/**
 * Lexing
 */

Lexer.prototype.token = function(src, top) {
  var src = src.replace(/^ +$/gm, '')
    , next
    , loose
    , cap
    , bull
    , b
    , item
    , space
    , i
    , l;

  while (src) {
    // newline
    if (cap = this.rules.newline.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[0].length > 1) {
        this.tokens.push({
          type: 'space'
        });
      }
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      cap = cap[0].replace(/^ {4}/gm, '');
      this.tokens.push({
        type: 'code',
        text: !this.options.pedantic
          ? cap.replace(/\n+$/, '')
          : cap
      });
      continue;
    }

    // fences (gfm)
    if (cap = this.rules.fences.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'code',
        lang: cap[2],
        text: cap[3]
      });
      continue;
    }

    // heading
    if (cap = this.rules.heading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[1].length,
        text: cap[2]
      });
      continue;
    }

    // table no leading pipe (gfm)
    if (top && (cap = this.rules.nptable.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i].split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // lheading
    if (cap = this.rules.lheading.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'heading',
        depth: cap[2] === '=' ? 1 : 2,
        text: cap[1]
      });
      continue;
    }

    // hr
    if (cap = this.rules.hr.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'hr'
      });
      continue;
    }

    // blockquote
    if (cap = this.rules.blockquote.exec(src)) {
      src = src.substring(cap[0].length);

      this.tokens.push({
        type: 'blockquote_start'
      });

      cap = cap[0].replace(/^ *> ?/gm, '');

      // Pass `top` to keep the current
      // "toplevel" state. This is exactly
      // how markdown.pl works.
      this.token(cap, top);

      this.tokens.push({
        type: 'blockquote_end'
      });

      continue;
    }

    // list
    if (cap = this.rules.list.exec(src)) {
      src = src.substring(cap[0].length);
      bull = cap[2];

      this.tokens.push({
        type: 'list_start',
        ordered: bull.length > 1
      });

      // Get each top-level item.
      cap = cap[0].match(this.rules.item);

      next = false;
      l = cap.length;
      i = 0;

      for (; i < l; i++) {
        item = cap[i];

        // Remove the list item's bullet
        // so it is seen as the next token.
        space = item.length;
        item = item.replace(/^ *([*+-]|\d+\.) +/, '');

        // Outdent whatever the
        // list item contains. Hacky.
        if (~item.indexOf('\n ')) {
          space -= item.length;
          item = !this.options.pedantic
            ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
            : item.replace(/^ {1,4}/gm, '');
        }

        // Determine whether the next list item belongs here.
        // Backpedal if it does not belong in this list.
        if (this.options.smartLists && i !== l - 1) {
          b = block.bullet.exec(cap[i+1])[0];
          if (bull !== b && !(bull.length > 1 && b.length > 1)) {
            src = cap.slice(i + 1).join('\n') + src;
            i = l - 1;
          }
        }

        // Determine whether item is loose or not.
        // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
        // for discount behavior.
        loose = next || /\n\n(?!\s*$)/.test(item);
        if (i !== l - 1) {
          next = item[item.length-1] === '\n';
          if (!loose) loose = next;
        }

        this.tokens.push({
          type: loose
            ? 'loose_item_start'
            : 'list_item_start'
        });

        // Recurse.
        this.token(item, false);

        this.tokens.push({
          type: 'list_item_end'
        });
      }

      this.tokens.push({
        type: 'list_end'
      });

      continue;
    }

    // html
    if (cap = this.rules.html.exec(src)) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: this.options.sanitize
          ? 'paragraph'
          : 'html',
        pre: cap[1] === 'pre' || cap[1] === 'script',
        text: cap[0]
      });
      continue;
    }

    // def
    if (top && (cap = this.rules.def.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.links[cap[1].toLowerCase()] = {
        href: cap[2],
        title: cap[3]
      };
      continue;
    }

    // table (gfm)
    if (top && (cap = this.rules.table.exec(src))) {
      src = src.substring(cap[0].length);

      item = {
        type: 'table',
        header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
        align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
        cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
      };

      for (i = 0; i < item.align.length; i++) {
        if (/^ *-+: *$/.test(item.align[i])) {
          item.align[i] = 'right';
        } else if (/^ *:-+: *$/.test(item.align[i])) {
          item.align[i] = 'center';
        } else if (/^ *:-+ *$/.test(item.align[i])) {
          item.align[i] = 'left';
        } else {
          item.align[i] = null;
        }
      }

      for (i = 0; i < item.cells.length; i++) {
        item.cells[i] = item.cells[i]
          .replace(/^ *\| *| *\| *$/g, '')
          .split(/ *\| */);
      }

      this.tokens.push(item);

      continue;
    }

    // top-level paragraph
    if (top && (cap = this.rules.paragraph.exec(src))) {
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'paragraph',
        text: cap[1][cap[1].length-1] === '\n'
          ? cap[1].slice(0, -1)
          : cap[1]
      });
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      // Top-level should never reach here.
      src = src.substring(cap[0].length);
      this.tokens.push({
        type: 'text',
        text: cap[0]
      });
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return this.tokens;
};

/**
 * Inline-Level Grammar
 */

var inline = {
  escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
  autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
  url: noop,
  tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
  link: /^!?\[(inside)\]\(href\)/,
  reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
  nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
  strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
  em: /^\b_((?:__|[\s\S])+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
  code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
  br: /^ {2,}\n(?!\s*$)/,
  del: noop,
  text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
};

inline._inside = /(?:\[[^\]]*\]|[^\]]|\](?=[^\[]*\]))*/;
inline._href = /\s*<?(.*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

/**
 * Normal Inline Grammar
 */

inline.normal = merge({}, inline);

/**
 * Pedantic Inline Grammar
 */

inline.pedantic = merge({}, inline.normal, {
  strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
  em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
});

/**
 * GFM Inline Grammar
 */

inline.gfm = merge({}, inline.normal, {
  escape: replace(inline.escape)('])', '~|])')(),
  url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
  del: /^~~(?=\S)([\s\S]*?\S)~~/,
  text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
});

/**
 * GFM + Line Breaks Inline Grammar
 */

inline.breaks = merge({}, inline.gfm, {
  br: replace(inline.br)('{2,}', '*')(),
  text: replace(inline.gfm.text)('{2,}', '*')()
});

/**
 * Inline Lexer & Compiler
 */

function InlineLexer(links, options) {
  this.options = options || marked.defaults;
  this.links = links;
  this.rules = inline.normal;

  if (!this.links) {
    throw new
      Error('Tokens array requires a `links` property.');
  }

  if (this.options.gfm) {
    if (this.options.breaks) {
      this.rules = inline.breaks;
    } else {
      this.rules = inline.gfm;
    }
  } else if (this.options.pedantic) {
    this.rules = inline.pedantic;
  }
}

/**
 * Expose Inline Rules
 */

InlineLexer.rules = inline;

/**
 * Static Lexing/Compiling Method
 */

InlineLexer.output = function(src, links, options) {
  var inline = new InlineLexer(links, options);
  return inline.output(src);
};

/**
 * Lexing/Compiling
 */

InlineLexer.prototype.output = function(src) {
  var out = ''
    , link
    , text
    , href
    , cap;

  while (src) {
    // escape
    if (cap = this.rules.escape.exec(src)) {
      src = src.substring(cap[0].length);
      out += cap[1];
      continue;
    }

    // autolink
    if (cap = this.rules.autolink.exec(src)) {
      src = src.substring(cap[0].length);
      if (cap[2] === '@') {
        text = cap[1][6] === ':'
          ? this.mangle(cap[1].substring(7))
          : this.mangle(cap[1]);
        href = this.mangle('mailto:') + text;
      } else {
        text = escape(cap[1]);
        href = text;
      }
      out += '<a href="'
        + href
        + '">'
        + text
        + '</a>';
      continue;
    }

    // url (gfm)
    if (cap = this.rules.url.exec(src)) {
      src = src.substring(cap[0].length);
      text = escape(cap[1]);
      href = text;
      out += '<a href="'
        + href
        + '">'
        + text
        + '</a>';
      continue;
    }

    // tag
    if (cap = this.rules.tag.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.options.sanitize
        ? escape(cap[0])
        : cap[0];
      continue;
    }

    // link
    if (cap = this.rules.link.exec(src)) {
      src = src.substring(cap[0].length);
      out += this.outputLink(cap, {
        href: cap[2],
        title: cap[3]
      });
      continue;
    }

    // reflink, nolink
    if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
      src = src.substring(cap[0].length);
      link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
      link = this.links[link.toLowerCase()];
      if (!link || !link.href) {
        out += cap[0][0];
        src = cap[0].substring(1) + src;
        continue;
      }
      out += this.outputLink(cap, link);
      continue;
    }

    // strong
    if (cap = this.rules.strong.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<strong>'
        + this.output(cap[2] || cap[1])
        + '</strong>';
      continue;
    }

    // em
    if (cap = this.rules.em.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<em>'
        + this.output(cap[2] || cap[1])
        + '</em>';
      continue;
    }

    // code
    if (cap = this.rules.code.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<code>'
        + escape(cap[2], true)
        + '</code>';
      continue;
    }

    // br
    if (cap = this.rules.br.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<br>';
      continue;
    }

    // del (gfm)
    if (cap = this.rules.del.exec(src)) {
      src = src.substring(cap[0].length);
      out += '<del>'
        + this.output(cap[1])
        + '</del>';
      continue;
    }

    // text
    if (cap = this.rules.text.exec(src)) {
      src = src.substring(cap[0].length);
      out += escape(cap[0]);
      continue;
    }

    if (src) {
      throw new
        Error('Infinite loop on byte: ' + src.charCodeAt(0));
    }
  }

  return out;
};

/**
 * Compile Link
 */

InlineLexer.prototype.outputLink = function(cap, link) {
  if (cap[0][0] !== '!') {
    return '<a href="'
      + escape(link.href)
      + '"'
      + (link.title
      ? ' title="'
      + escape(link.title)
      + '"'
      : '')
      + '>'
      + this.output(cap[1])
      + '</a>';
  } else {
    return '<img src="'
      + escape(link.href)
      + '" alt="'
      + escape(cap[1])
      + '"'
      + (link.title
      ? ' title="'
      + escape(link.title)
      + '"'
      : '')
      + '>';
  }
};

/**
 * Smartypants Transformations
 */

InlineLexer.prototype.smartypants = function(text) {
  if (!this.options.smartypants) return text;
  return text
    .replace(/--/g, '—')
    .replace(/'([^']*)'/g, '‘$1’')
    .replace(/"([^"]*)"/g, '“$1”')
    .replace(/\.{3}/g, '…');
};

/**
 * Mangle Links
 */

InlineLexer.prototype.mangle = function(text) {
  var out = ''
    , l = text.length
    , i = 0
    , ch;

  for (; i < l; i++) {
    ch = text.charCodeAt(i);
    if (Math.random() > 0.5) {
      ch = 'x' + ch.toString(16);
    }
    out += '&#' + ch + ';';
  }

  return out;
};

/**
 * Parsing & Compiling
 */

function Parser(options) {
  this.tokens = [];
  this.token = null;
  this.options = options || marked.defaults;
}

/**
 * Static Parse Method
 */

Parser.parse = function(src, options) {
  var parser = new Parser(options);
  return parser.parse(src);
};

/**
 * Parse Loop
 */

Parser.prototype.parse = function(src) {
  this.inline = new InlineLexer(src.links, this.options);
  this.tokens = src.reverse();

  var out = '';
  while (this.next()) {
    out += this.tok();
  }

  return out;
};

/**
 * Next Token
 */

Parser.prototype.next = function() {
  return this.token = this.tokens.pop();
};

/**
 * Preview Next Token
 */

Parser.prototype.peek = function() {
  return this.tokens[this.tokens.length-1] || 0;
};

/**
 * Parse Text Tokens
 */

Parser.prototype.parseText = function() {
  var body = this.token.text;

  while (this.peek().type === 'text') {
    body += '\n' + this.next().text;
  }

  return this.inline.output(body);
};

/**
 * Parse Current Token
 */

Parser.prototype.tok = function() {
  switch (this.token.type) {
    case 'space': {
      return '';
    }
    case 'hr': {
      return '<hr>\n';
    }
    case 'heading': {
      return '<h'
        + this.token.depth
        + '>'
        + this.inline.output(this.token.text)
        + '</h'
        + this.token.depth
        + '>\n';
    }
    case 'code': {
      if (this.options.highlight) {
        var code = this.options.highlight(this.token.text, this.token.lang);
        if (code != null && code !== this.token.text) {
          this.token.escaped = true;
          this.token.text = code;
        }
      }

      if (!this.token.escaped) {
        this.token.text = escape(this.token.text, true);
      }

      return '<pre><code'
        + (this.token.lang
        ? ' class="'
        + this.options.langPrefix
        + this.token.lang
        + '"'
        : '')
        + '>'
        + this.token.text
        + '</code></pre>\n';
    }
    case 'table': {
      var body = ''
        , heading
        , i
        , row
        , cell
        , j;

      // header
      body += '<thead>\n<tr>\n';
      for (i = 0; i < this.token.header.length; i++) {
        heading = this.inline.output(this.token.header[i]);
        body += this.token.align[i]
          ? '<th align="' + this.token.align[i] + '">' + heading + '</th>\n'
          : '<th>' + heading + '</th>\n';
      }
      body += '</tr>\n</thead>\n';

      // body
      body += '<tbody>\n'
      for (i = 0; i < this.token.cells.length; i++) {
        row = this.token.cells[i];
        body += '<tr>\n';
        for (j = 0; j < row.length; j++) {
          cell = this.inline.output(row[j]);
          body += this.token.align[j]
            ? '<td align="' + this.token.align[j] + '">' + cell + '</td>\n'
            : '<td>' + cell + '</td>\n';
        }
        body += '</tr>\n';
      }
      body += '</tbody>\n';

      return '<table>\n'
        + body
        + '</table>\n';
    }
    case 'blockquote_start': {
      var body = '';

      while (this.next().type !== 'blockquote_end') {
        body += this.tok();
      }

      return '<blockquote>\n'
        + body
        + '</blockquote>\n';
    }
    case 'list_start': {
      var type = this.token.ordered ? 'ol' : 'ul'
        , body = '';

      while (this.next().type !== 'list_end') {
        body += this.tok();
      }

      return '<'
        + type
        + '>\n'
        + body
        + '</'
        + type
        + '>\n';
    }
    case 'list_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.token.type === 'text'
          ? this.parseText()
          : this.tok();
      }

      return '<li>'
        + body
        + '</li>\n';
    }
    case 'loose_item_start': {
      var body = '';

      while (this.next().type !== 'list_item_end') {
        body += this.tok();
      }

      return '<li>'
        + body
        + '</li>\n';
    }
    case 'html': {
      return !this.token.pre && !this.options.pedantic
        ? this.inline.output(this.token.text)
        : this.token.text;
    }
    case 'paragraph': {
      return '<p>'
        + this.inline.output(this.token.text)
        + '</p>\n';
    }
    case 'text': {
      return '<p>'
        + this.parseText()
        + '</p>\n';
    }
  }
};

/**
 * Helpers
 */

function escape(html, encode) {
  return html
    .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function replace(regex, opt) {
  regex = regex.source;
  opt = opt || '';
  return function self(name, val) {
    if (!name) return new RegExp(regex, opt);
    val = val.source || val;
    val = val.replace(/(^|[^\[])\^/g, '$1');
    regex = regex.replace(name, val);
    return self;
  };
}

function noop() {}
noop.exec = noop;

function merge(obj) {
  var i = 1
    , target
    , key;

  for (; i < arguments.length; i++) {
    target = arguments[i];
    for (key in target) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        obj[key] = target[key];
      }
    }
  }

  return obj;
}

/**
 * Marked
 */

function marked(src, opt, callback) {
  if (callback || typeof opt === 'function') {
    if (!callback) {
      callback = opt;
      opt = null;
    }

    if (opt) opt = merge({}, marked.defaults, opt);

    var tokens = Lexer.lex(tokens, opt)
      , highlight = opt.highlight
      , pending = 0
      , l = tokens.length
      , i = 0;

    if (!highlight || highlight.length < 3) {
      return callback(null, Parser.parse(tokens, opt));
    }

    var done = function() {
      delete opt.highlight;
      var out = Parser.parse(tokens, opt);
      opt.highlight = highlight;
      return callback(null, out);
    };

    for (; i < l; i++) {
      (function(token) {
        if (token.type !== 'code') return;
        pending++;
        return highlight(token.text, token.lang, function(err, code) {
          if (code == null || code === token.text) {
            return --pending || done();
          }
          token.text = code;
          token.escaped = true;
          --pending || done();
        });
      })(tokens[i]);
    }

    return;
  }
  try {
    if (opt) opt = merge({}, marked.defaults, opt);
    return Parser.parse(Lexer.lex(src, opt), opt);
  } catch (e) {
    e.message += '\nPlease report this to https://github.com/chjj/marked.';
    if ((opt || marked.defaults).silent) {
      return '<p>An error occured:</p><pre>'
        + escape(e.message + '', true)
        + '</pre>';
    }
    throw e;
  }
}

/**
 * Options
 */

marked.options =
marked.setOptions = function(opt) {
  merge(marked.defaults, opt);
  return marked;
};

marked.defaults = {
  gfm: true,
  tables: true,
  breaks: false,
  pedantic: false,
  sanitize: false,
  smartLists: false,
  silent: false,
  highlight: null,
  langPrefix: 'lang-'
};

/**
 * Expose
 */

marked.Parser = Parser;
marked.parser = Parser.parse;

marked.Lexer = Lexer;
marked.lexer = Lexer.lex;

marked.InlineLexer = InlineLexer;
marked.inlineLexer = InlineLexer.output;

marked.parse = marked;

if (typeof exports === 'object') {
  module.exports = marked;
} else if (typeof define === 'function' && define.amd) {
  define(function() { return marked; });
} else {
  this.marked = marked;
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

(function($) {
    'use strict';

    // hide the whole page so we dont see the DOM flickering
    // will be shown upon page load complete or error
    $('html').addClass('md-hidden-load');

    // register our $.md object
    $.md = function (method){
        if ($.md.publicMethods[method]) {
            return $.md.publicMethods[method].apply(this,
                Array.prototype.slice.call(arguments, 1)
            );
        } else {
            $.error('Method ' + method + ' does not exist on jquery.md');
        }
    };
    // default config
    $.md.config = {
        title:  null,
        lineBreaks: 'gfm',
        additionalFooterText: '',
        anchorCharacter: '&para;',
        pageMenu: {
            disable: false,
            returnAnchor: "[top]",
            useHeadings: "h2"
        },
        parseHeader: false
    };

    // the location of the main markdown file we display
    $.md.mainHref = '';

    // the in-page anchor that is specified after the !
    $.md.inPageAnchor = '';

}(jQuery));

var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var MDwiki;
(function (MDwiki) {
    (function (Core) {
        var ScriptResource = (function () {
            function ScriptResource(url, loadstage, finishstage) {
                if (typeof loadstage === "undefined") { loadstage = 'skel_ready'; }
                if (typeof finishstage === "undefined") { finishstage = 'gimmick'; }
                this.url = url;
                this.loadstage = loadstage;
                this.finishstage = finishstage;
            }
            return ScriptResource;
        })();
        Core.ScriptResource = ScriptResource;

        var CssResource = (function () {
            function CssResource(url, finishstage) {
                if (typeof finishstage === "undefined") { finishstage = 'gimmick'; }
                this.url = url;
                this.finishstage = finishstage;
            }
            return CssResource;
        })();
        Core.CssResource = CssResource;

        var GimmickLinkParts = (function () {
            function GimmickLinkParts(trigger, options, href) {
                this.trigger = trigger;
                this.options = options;
                this.href = href;
            }
            return GimmickLinkParts;
        })();

        var GimmickHandler = (function () {
            function GimmickHandler(trigger, handler, loadstage) {
                if (typeof loadstage === "undefined") { loadstage = 'gimmick'; }
                this.trigger = trigger;
                this.handler = handler;
                this.loadstage = loadstage;
            }
            return GimmickHandler;
        })();
        Core.GimmickHandler = GimmickHandler;

        var Module = (function () {
            function Module() {
            }
            Module.prototype.init = function () {
            };

            Module.prototype.registerScriptResource = function (res) {
                var loadDone = $.Deferred();

                $.md.stage(res.loadstage).subscribe(function (done) {
                    if (res.url.startsWith('//') || res.url.startsWith('http')) {
                        $.getScript(res.url, function () {
                            return loadDone.resolve();
                        });
                    } else {
                        var script = document.createElement('script');
                        script.type = 'text/javascript';
                        script.text = res.url;
                        document.body.appendChild(script);
                        loadDone.resolve();
                    }
                    done();
                });

                $.md.stage(res.finishstage).subscribe(function (done) {
                    loadDone.done(function () {
                        return done();
                    });
                });
            };
            Module.prototype.registerCssResource = function (resource) {
            };
            return Module;
        })();
        Core.Module = Module;

        var Gimmick = (function (_super) {
            __extends(Gimmick, _super);
            function Gimmick() {
                _super.apply(this, arguments);
                this.Handlers = [];
            }
            Gimmick.prototype.init = function () {
            };
            Gimmick.prototype.addHandler = function (trigger, cb, loadstage) {
                if (typeof loadstage === "undefined") { loadstage = 'gimmick'; }
                var handler = new GimmickHandler(trigger, cb, loadstage);
                this.Handlers.push(handler);
            };
            return Gimmick;
        })(Module);
        Core.Gimmick = Gimmick;

        function getGimmickLinkParts($link) {
            var link_text = $.trim($link.toptext());

            if (link_text.match(/gimmick:/i) === null) {
                return null;
            }
            var href = $.trim($link.attr('href'));
            var r = /gimmick\s?:\s*([^(\s]*)\s*\(?\s*{?(.*)\s*}?\)?/i;
            var matches = r.exec(link_text);
            if (matches === null || matches[1] === undefined) {
                $.error('Error matching a gimmick: ' + link_text);
                return null;
            }
            var trigger = matches[1].toLowerCase();
            var args = null;

            if (matches[2].toLowerCase().indexOf("gimmick") != 0) {
                var params = $.trim(matches[2].toString());
                if (params.charAt(params.length - 1) === ')') {
                    params = params.substring(0, params.length - 1);
                }

                if (params.charAt(params.length - 1) === '}') {
                    params = params.substring(0, params.length - 1);
                }

                params = '({' + params + '})';

                var replace_quotes = new RegExp("'", 'g');
                params = params.replace(replace_quotes, '"');

                try  {
                    args = eval(params);
                } catch (err) {
                    $.error('error parsing argument of gimmick: ' + link_text + 'giving error: ' + err);
                }
            }
            return new GimmickLinkParts(trigger, args, href);
        }

        var GimmickLoader = (function () {
            function GimmickLoader() {
                this.registeredModules = [];
                this.requiredGimmicks = [];
                this.gimmicks = [];
            }
            GimmickLoader.prototype.initModules = function () {
                this.registeredModules.map(function (m) {
                    return m.init();
                });
            };
            GimmickLoader.prototype.registerModule = function (mod) {
                this.registeredModules.push(mod);
            };
            GimmickLoader.prototype.registerGimmick = function (gmck) {
                this.gimmicks.push(gmck);
            };

            GimmickLoader.prototype.registerBuiltInGimmicks = function () {
                var themechooser = new Core.ThemeChooserGimmick();
                this.registerGimmick(themechooser);
            };

            GimmickLoader.prototype.initGimmicks = function () {
                var _this = this;
                this.registerBuiltInGimmicks();
                var $gimmick_links = $('a:icontains(gimmick:)');
                $gimmick_links.map(function (i, e) {
                    var $link = $(e);
                    var parts = getGimmickLinkParts($link);
                    if (_this.requiredGimmicks.indexOf(parts.trigger) < 0)
                        _this.requiredGimmicks.push(parts.trigger);
                });
                this.requiredGimmicks.map(function (trigger) {
                    var gmck = _this.selectGimmick(trigger);
                    gmck.init();
                });
            };

            GimmickLoader.prototype.loadGimmicks = function () {
                var _this = this;
                var $gimmick_links = $('a:icontains(gimmick:)');
                $gimmick_links.map(function (i, e) {
                    var $link = $(e);
                    var parts = getGimmickLinkParts($link);
                    var handler = _this.selectGimmickHandler(parts.trigger);
                    $.md.stage(handler.loadstage).subscribe(function (done) {
                        handler.handler($link, parts.options, $link.attr('href'));
                        done();
                    });
                });
            };
            GimmickLoader.prototype.selectGimmick = function (trigger) {
                var gimmicks = this.gimmicks.filter(function (g) {
                    var triggers = g.Handlers.map(function (h) {
                        return h.trigger;
                    });
                    if (triggers.indexOf(trigger) >= 0)
                        return true;
                });
                return gimmicks[0];
            };
            GimmickLoader.prototype.selectGimmickHandler = function (trigger) {
                var gimmick = this.selectGimmick(trigger);
                var handler = gimmick.Handlers.filter(function (h) {
                    return h.trigger == trigger;
                })[0];
                return handler;
            };
            GimmickLoader.prototype.findActiveLinkTrigger = function () {
                var activeLinkTriggers = [];

                var $gimmicks = $('a:icontains(gimmick:)');
                $gimmicks.each(function (i, e) {
                    var parts = getGimmickLinkParts($(e));
                    if (activeLinkTriggers.indexOf(parts.trigger) === -1)
                        activeLinkTriggers.push(parts.trigger);
                });
                return activeLinkTriggers;
            };
            return GimmickLoader;
        })();
        Core.GimmickLoader = GimmickLoader;
    })(MDwiki.Core || (MDwiki.Core = {}));
    var Core = MDwiki.Core;
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    (function (Util) {
        (function (LogLevel) {
            LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
            LogLevel[LogLevel["DEBUG"] = 1] = "DEBUG";
            LogLevel[LogLevel["INFO"] = 2] = "INFO";
            LogLevel[LogLevel["WARN"] = 3] = "WARN";
            LogLevel[LogLevel["ERROR"] = 4] = "ERROR";
            LogLevel[LogLevel["FATAL"] = 5] = "FATAL";
        })(Util.LogLevel || (Util.LogLevel = {}));
        var LogLevel = Util.LogLevel;
        var Logger = (function () {
            function Logger(level) {
                this.logLevel = 4 /* ERROR */;
                this.logLevel = level;
            }
            Logger.prototype.log = function (loglevel, msg) {
                console.log('[' + loglevel.toUpperCase() + '] ' + msg);
            };
            Logger.prototype.trace = function (msg) {
                if (this.logLevel >= 0 /* TRACE */)
                    this.log('TRACE', msg);
            };
            Logger.prototype.info = function (msg) {
                if (this.logLevel >= 2 /* INFO */)
                    this.log('INFO', msg);
            };
            Logger.prototype.debug = function (msg) {
                if (this.logLevel >= 1 /* DEBUG */)
                    this.log('DEBUG', msg);
            };
            Logger.prototype.warn = function (msg) {
                if (this.logLevel >= 3 /* WARN */)
                    this.log('WARN', msg);
            };
            Logger.prototype.error = function (msg) {
                if (this.logLevel >= 4 /* ERROR */)
                    this.log('ERROR', msg);
            };
            Logger.prototype.fatal = function (msg) {
                if (this.logLevel >= 5 /* FATAL */)
                    this.log('FATAL', msg);
            };
            return Logger;
        })();
        Util.Logger = Logger;
    })(MDwiki.Util || (MDwiki.Util = {}));
    var Util = MDwiki.Util;
})(MDwiki || (MDwiki = {}));
(function ($) {
    var logger;
    if (typeof (MDwikiEnableDebug) != "undefined")
        logger = new MDwiki.Util.Logger(1 /* DEBUG */);
    else
        logger = new MDwiki.Util.Logger(4 /* ERROR */);

    $.md.getLogger = function () {
        return logger;
    };

    $.initMDwiki = function (name) {
        $.md.wiki = new MDwiki.Core.Wiki();
        $.md.stage = function (name) {
            return $.md.wiki.stages.getStage(name);
        };
    };
}(jQuery));
var Markdown = (function () {
    function Markdown(markdownSource, options) {
        if (typeof options === "undefined") { options = {}; }
        this.defaultOptions = {
            gfm: true,
            tables: true,
            breaks: true
        };
        this.markdownSource = markdownSource;
        this.options = options;
    }
    Markdown.prototype.transform = function () {
        marked.setOptions(this.options);
        var uglyHtml = marked(this.markdownSource);
        return uglyHtml;
    };
    return Markdown;
})();

var Navbar = (function () {
    function Navbar(navbarMarkdown) {
        this.navbarMarkdown = navbarMarkdown;
        var md = new Markdown(navbarMarkdown);
        this.uglyHtml = md.transform();
    }
    Navbar.prototype.render = function () {
        var h = $('<div>' + this.uglyHtml + '</div>');

        h.find('p').each(function (i, e) {
            var el = $(e);
            el.replaceWith(el.html());
        });
        $('#md-menu').append(h.html());
    };
    Navbar.prototype.hideIfHasNoLinks = function () {
        var num_links = $('#md-menu a').length;
        var has_header = $('#md-menu .navbar-brand').eq(0).toptext().trim().length > 0;
        if (!has_header && num_links <= 1)
            $('#md-menu').hide();
    };
    return Navbar;
})();
var MDwiki;
(function (MDwiki) {
    (function (Core) {
        var Resource = (function () {
            function Resource(url, dataType) {
                if (typeof dataType === "undefined") { dataType = 'text'; }
                this.url = url;
                this.dataType = dataType;
            }
            Resource.fetch = function (url, dataType) {
                if (typeof dataType === "undefined") { dataType = 'text'; }
                var jqxhr = $.ajax({
                    url: url,
                    dataType: dataType
                });
                return jqxhr;
            };
            return Resource;
        })();
        Core.Resource = Resource;

        var StageChain = (function () {
            function StageChain() {
                this.stages = [];
            }
            StageChain.prototype.reset = function () {
                var new_stages = [];
                for (var i = 0; i < this.stages.length; i++) {
                    var name = this.stages[i].name;
                    new_stages.push(new Stage(name));
                }
            };
            StageChain.prototype.appendArray = function (st) {
                var _this = this;
                st.map(function (s) {
                    return _this.append(s);
                });
            };
            StageChain.prototype.append = function (s) {
                var len = this.stages.length;
                if (len == 0) {
                    this.stages.push(s);
                    return;
                }
                var last = this.stages[len - 1];
                last.finished().done(function () {
                    return s.start();
                });
                this.stages.push(s);
            };
            StageChain.prototype.run = function () {
                this.stages[0].start();
            };

            StageChain.prototype.getStage = function (name) {
                return this.stages.filter(function (s) {
                    return s.name == name;
                })[0];
            };
            return StageChain;
        })();
        Core.StageChain = StageChain;

        var Stage = (function () {
            function Stage(name) {
                this.started = false;
                this.subscribedFuncs = [];
                this.allFinishedDfd = $.Deferred();
                this.name = name;
            }
            Stage.prototype.finished = function () {
                return this.allFinishedDfd;
            };

            Stage.prototype.subscribe = function (fn) {
                if (this.started)
                    throw 'Stage already started';

                this.subscribedFuncs.push(fn);
            };

            Stage.prototype.start = function () {
                var _this = this;
                console.dir("running stage " + this.name);
                this.started = true;
                var num_outstanding = this.subscribedFuncs.length;

                if (num_outstanding == 0) {
                    this.allFinishedDfd.resolve();
                    return;
                }

                this.subscribedFuncs.map(function (subbedFn) {
                    var doneCallback = function () {
                        --num_outstanding || _this.allFinishedDfd.resolve();
                    };
                    subbedFn(doneCallback);
                });
            };
            return Stage;
        })();
        Core.Stage = Stage;
    })(MDwiki.Core || (MDwiki.Core = {}));
    var Core = MDwiki.Core;
})(MDwiki || (MDwiki = {}));
var MDwiki;
(function (MDwiki) {
    (function (Core) {
        var StringUtil = (function () {
            function StringUtil() {
            }
            StringUtil.startsWith = function (search, suffix) {
                return search.slice(0, suffix.length) == suffix;
            };
            StringUtil.endsWith = function (search, prefix) {
                return search.slice(search.length - prefix.length, search.length) == prefix;
            };
            return StringUtil;
        })();

        var Theme = (function () {
            function Theme(name, styles, scripts) {
                if (typeof scripts === "undefined") { scripts = []; }
                this.name = name;
                this.styles = styles;
                this.scripts = scripts;
            }
            Theme.prototype.onLoad = function () {
            };
            return Theme;
        })();

        var BootswatchTheme = (function (_super) {
            __extends(BootswatchTheme, _super);
            function BootswatchTheme(name) {
                _super.call(this, name, [], []);
                this.baseUrl = '//netdna.bootstrapcdn.com/bootswatch/3.0.2/';
                this.baseFilename = '/bootstrap.min.css';
                this.styles = [this.url];
            }
            Object.defineProperty(BootswatchTheme.prototype, "url", {
                get: function () {
                    return this.baseUrl + this.name + this.baseFilename;
                },
                enumerable: true,
                configurable: true
            });
            return BootswatchTheme;
        })(Theme);

        var ThemeChooser = (function () {
            function ThemeChooser() {
                this.themes = [];
                this.enableChooser = false;
            }
            Object.defineProperty(ThemeChooser.prototype, "themeNames", {
                get: function () {
                    return this.themes.map(function (t) {
                        return t.name;
                    });
                },
                enumerable: true,
                configurable: true
            });

            Object.defineProperty(ThemeChooser.prototype, "currentTheme", {
                get: function () {
                    var theme = window.localStorage.getItem("theme");
                    return theme;
                },
                set: function (val) {
                    if (val == '')
                        window.localStorage.removeItem("theme");
                    else
                        window.localStorage.setItem("theme", val);
                },
                enumerable: true,
                configurable: true
            });

            ThemeChooser.prototype.register = function (theme) {
                this.themes.push(theme);
            };
            ThemeChooser.prototype.loadDefaultTheme = function () {
                this.load(this.currentTheme);
            };

            ThemeChooser.prototype.load = function (name) {
                var target = this.themes.filter(function (t) {
                    return t.name == name;
                });
                if (target.length <= 0)
                    return;
                else
                    this.applyTheme(target[0]);
            };

            ThemeChooser.prototype.applyTheme = function (theme) {
                $('link[rel=stylesheet][href*="netdna.bootstrapcdn.com"]').remove();
                var link_tag = this.createLinkTag(theme.styles[0]);
                $('head').append(link_tag);
            };

            ThemeChooser.prototype.createLinkTag = function (url) {
                return $('<link rel="stylesheet" type="text/css">').attr('href', url);
            };
            return ThemeChooser;
        })();

        var ThemeChooserGimmick = (function (_super) {
            __extends(ThemeChooserGimmick, _super);
            function ThemeChooserGimmick() {
                _super.call(this);
                var tc = new ThemeChooser();
                registerDefaultThemes(tc);

                $.md.stage('bootstrap').subscribe(function (done) {
                    tc.loadDefaultTheme();
                    done();
                });

                var build_chooser = function ($links, opt, text) {
                    tc.enableChooser = true;
                    themechooser($links, opt, text, tc);
                };
                var apply_theme = function ($links, opt, text) {
                    set_theme($links, opt, text, tc);
                };

                this.addHandler('themechooser', build_chooser, 'skel_ready');
                this.addHandler('theme', apply_theme);
            }
            return ThemeChooserGimmick;
        })(Core.Gimmick);
        Core.ThemeChooserGimmick = ThemeChooserGimmick;
        ;

        var set_theme = function ($links, opt, text, tc) {
            opt.name = opt.name || text;
            $links.each(function (i, link) {
                $.md.stage('postgimmick').subscribe(function (done) {
                    if (!tc.currentTheme || tc.currentTheme == '' || tc.enableChooser == false)
                        tc.load(opt.name);
                    done();
                });
            });
            $links.remove();
        };

        function registerDefaultThemes(tc) {
            var bootswatch_theme_names = [
                'amelia', 'cerulean', 'cosmo', 'cyborg', 'flatly', 'journal',
                'readable', 'simplex', 'slate', 'spacelab', 'united', 'yeti'
            ];
            bootswatch_theme_names.map(function (name) {
                return tc.register(new BootswatchTheme(name));
            });
        }

        var themechooser = function ($links, opt, text, tc) {
            return $links.each(function (i, e) {
                var $this = $(e);
                var $chooser = $('<a href=""></a><ul></ul>');
                $chooser.eq(0).text(text);

                $.each(tc.themeNames, function (i, themeName) {
                    var $li = $('<li></li>');
                    $chooser.eq(1).append($li);
                    var $a = $('<a/>').text(themeName).attr('href', '').click(function (ev) {
                        ev.preventDefault();
                        tc.currentTheme = themeName;
                        window.location.reload();
                    }).appendTo($li);
                });

                $chooser.eq(1).append('<li class="divider" />');
                var $li = $('<li/>');
                var $a_use_default = $('<a>Use default</a>');
                $a_use_default.click(function (ev) {
                    ev.preventDefault();
                    tc.currentTheme = '';
                    window.location.reload();
                });
                $li.append($a_use_default);
                $chooser.eq(1).append($li);

                $chooser.eq(1).append('<li class="divider" />');
                $chooser.eq(1).append('<li><a href="http://www.bootswatch.com">Powered by Bootswatch</a></li>');
                $this.replaceWith($chooser);
            });
        };
    })(MDwiki.Core || (MDwiki.Core = {}));
    var Core = MDwiki.Core;
})(MDwiki || (MDwiki = {}));

var Logger = MDwiki.Util.Logger;

var MDwiki;
(function (MDwiki) {
    (function (Core) {
        var Wiki = (function () {
            function Wiki() {
                var _this = this;
                this.stages = new Core.StageChain();
                this.gimmicks = new Core.GimmickLoader();
                var stage_names = ([
                    'init', 'load', 'transform', 'ready', 'skel_ready',
                    'bootstrap', 'pregimmick', 'gimmick', 'postgimmick', 'all_ready',
                    'final_tests'
                ]);
                stage_names.map(function (n) {
                    return _this.stages.append(new Core.Stage(n));
                });
            }
            Wiki.prototype.run = function () {
                this.registerFetchConfigAndNavigation();
                this.registerFetchMarkdown();
                this.registerPageTransformation();
                this.registerGimmickLoad();
                this.registerClearContent();
                this.registerFinalTasks();

                this.stages.run();
            };
            Wiki.prototype.registerFetchConfigAndNavigation = function () {
                var self = this;

                $.md.stage('init').subscribe(function (done) {
                    var dfd1 = Core.Resource.fetch('config.json');
                    var dfd2 = Core.Resource.fetch('navigation.md');
                    dfd1.done(function (config) {
                        dfd2.done(function (nav) {
                            var data_json = JSON.parse(config);
                            $.md.config = $.extend($.md.config, data_json);
                            self.registerBuildNavigation(nav);
                            done();
                        });
                    });
                });
            };
            Wiki.prototype.registerPageTransformation = function () {
                $.md.stage('ready').subscribe(function (done) {
                    $.md('createBasicSkeleton');
                    done();
                });

                $.md.stage('bootstrap').subscribe(function (done) {
                    $.mdbootstrap('bootstrapify');
                    $.md.processPageLinks($('#md-content'), $.md.baseUrl);
                    done();
                });
            };

            Wiki.prototype.transformMarkdown = function (markdown) {
                var options = {
                    gfm: true,
                    tables: true,
                    breaks: true
                };
                if ($.md.config.lineBreaks === 'original')
                    options.breaks = false;
                else if ($.md.config.lineBreaks === 'gfm')
                    options.breaks = true;

                marked.setOptions(options);

                var uglyHtml = marked(markdown);
                return uglyHtml;
            };

            Wiki.prototype.registerClearContent = function () {
                $.md.stage('init').subscribe(function (done) {
                    $('#md-all').empty();
                    var skel = '<div id="md-body"><div id="md-title"></div><div id="md-menu">' + '</div><div id="md-content"></div></div>';
                    $('#md-all').prepend($(skel));
                    done();
                });
            };
            Wiki.prototype.registerFetchMarkdown = function () {
                var _this = this;
                var md = '';
                $.md.stage('init').subscribe(function (done) {
                    var ajaxReq = {
                        url: $.md.mainHref,
                        dataType: 'text'
                    };
                    $.ajax(ajaxReq).done(function (data) {
                        md = data;
                        done();
                    }).fail(function () {
                        var log = $.md.getLogger();
                        log.fatal('Could not get ' + $.md.mainHref);
                        done();
                    });
                });

                $.md.stage('transform').subscribe(function (done) {
                    var len = $.md.mainHref.lastIndexOf('/');
                    var baseUrl = $.md.mainHref.substring(0, len + 1);
                    $.md.baseUrl = baseUrl;
                    done();
                });

                $.md.stage('transform').subscribe(function (done) {
                    var uglyHtml = _this.transformMarkdown(md);
                    $('#md-content').html(uglyHtml);
                    md = '';
                    done();
                });
            };

            Wiki.prototype.registerGimmickLoad = function () {
                var _this = this;
                $.md.stage('ready').subscribe(function (done) {
                    _this.gimmicks.initModules();
                    _this.gimmicks.initGimmicks();
                    _this.gimmicks.loadGimmicks();
                    done();
                });
            };
            Wiki.prototype.registerBuildNavigation = function (navMD) {
                $.md.stage('transform').subscribe(function (done) {
                    if (navMD === '') {
                        var log = $.md.getLogger();
                        log.info('no navgiation.md found, not using a navbar');
                        done();
                        return;
                    }
                    var navHtml = marked(navMD);
                    var h = $('<div>' + navHtml + '</div>');

                    h.find('br').remove();
                    h.find('p').each(function (i, e) {
                        var el = $(e);
                        el.replaceWith(el.html());
                    });
                    $('#md-menu').append(h.html());
                    done();
                });

                $.md.stage('bootstrap').subscribe(function (done) {
                    $.md.processPageLinks($('#md-menu'));
                    done();
                });

                $.md.stage('postgimmick').subscribe(function (done) {
                    done();
                });
            };

            Wiki.prototype.registerFinalTasks = function () {
                $.md.stage('all_ready').finished().done(function () {
                    $('html').removeClass('md-hidden-load');

                    if (typeof window['callPhantom'] === 'function') {
                        window['callPhantom']({});
                    }
                });
                $.md.stage('final_tests').finished().done(function () {
                    $('body').append('<span id="start-tests"></span>');
                    $('#start-tests').hide();
                });
            };
            return Wiki;
        })();
        Core.Wiki = Wiki;
    })(MDwiki.Core || (MDwiki.Core = {}));
    var Core = MDwiki.Core;
})(MDwiki || (MDwiki = {}));

(function($) {
    'use strict';

    // modify internal links so we load them through our engine
    $.md.processPageLinks = function (domElement, baseUrl) {
        var html = $(domElement);
        if (baseUrl === undefined) {
            baseUrl = '';
        }
        // HACK against marked: empty links will have empy href attribute
        // we remove the href attribute from the a tag
        html.find('a').not('#md-menu a').filter(function () {
            var $this = $(this);
            var attr = $this.attr('href');
            if (!attr || attr.length === 0)
                $this.removeAttr('href');
        });

        html.find('a, img').each(function(i,e) {
            var link = $(e);
            // link must be jquery collection
            var isImage = false;
            var hrefAttribute = 'href';

            if (!link.attr(hrefAttribute)) {
                isImage = true;
                hrefAttribute = 'src';
            }
            var href = link.attr(hrefAttribute);

            if (href && href.lastIndexOf ('#!') >= 0)
                return;

            if (!isImage && href.startsWith ('#') && !href.startsWith('#!')) {
                // in-page link
                link.click(function(ev) {
                    ev.preventDefault();
                    $.md.scrollToInPageAnchor (href);
                });
            }

            if (! $.md.util.isRelativeUrl(href))
                return;

            if (isImage && ! $.md.util.isRelativePath(href))
                return;

            if (!isImage && $.md.util.isGimmickLink(link))
                return;

            function build_link (url) {
                if ($.md.util.hasMarkdownFileExtension (url))
                    return '#!' + url;
                else
                    return url;
            }

            var newHref = baseUrl + href;
            if (isImage)
                link.attr(hrefAttribute, newHref);
            else if ($.md.util.isRelativePath (href))
                link.attr(hrefAttribute, build_link(newHref));
            else
                link.attr(hrefAttribute, build_link(href));
        });
    };




    function extractHashData() {
        // first char is the # or #!
        var href;
        if (window.location.hash.startsWith('#!')) {
            href = window.location.hash.substring(2);
        } else {
            href = window.location.hash.substring(1);
        }
        href = decodeURIComponent(href);

        // extract possible in-page anchor
        var ex_pos = href.indexOf('#');
        if (ex_pos !== -1) {
            $.md.inPageAnchor = href.substring(ex_pos + 1);
            $.md.mainHref = href.substring(0, ex_pos);
        } else {
            $.md.mainHref = href;
        }
    }

    function appendDefaultFilenameToHash () {
        var newHashString = '';
        var currentHashString = window.location.hash || '';
        if (currentHashString === '' ||
            currentHashString === '#'||
            currentHashString === '#!')
        {
            newHashString = '#!index.md';
        }
        else if (currentHashString.startsWith ('#!') &&
                 currentHashString.endsWith('/')
                ) {
            newHashString = currentHashString + 'index.md';
        }
        if (newHashString)
            window.location.hash = newHashString;
    }

    $.initMDwiki();

    $(document).ready(function () {

        // stage init stuff

        extractHashData();

        appendDefaultFilenameToHash();

        $(window).bind('hashchange', function () {
            window.location.reload(false);
        });

        $.md.wiki.run();
    });
}(jQuery));

(function($) {
    var publicMethods = {
        isRelativeUrl: function(url) {
            if (url === undefined) {
                return false;
            }
            // if there is :// in it, its considered absolute
            // else its relative
            if (url.indexOf('://') === -1) {
                return true;
            } else {
                return false;
            }
        },
        isRelativePath: function(path) {
            if (path === undefined)
                return false;
            if (path.startsWith('/'))
                return false;
            return true;
        },
        isGimmickLink: function(domAnchor) {
            if (domAnchor.toptext().indexOf ('gimmick:') !== -1) {
                return true;
            } else {
                return false;
            }
        },
        hasMarkdownFileExtension: function (str) {
            if (!str) return false;
            var markdownExtensions = [ '.md', '.markdown', '.mdown' ];
            var result = false;
            var value = str.toLowerCase().split('#')[0];
            $(markdownExtensions).each(function (i,ext) {
                if (value.toLowerCase().endsWith (ext)) {
                    result = true;
                }
            });
            return result;
        },
        wait: function(time) {
            return $.Deferred(function(dfd) {
                setTimeout(dfd.resolve, time);
            });
        }
    };
    $.md.util = $.extend ({}, $.md.util, publicMethods);

    // turns hostname/path links into http://hostname/path links
    // we need to do this because if accessed by file:///, we need a different
    // transport scheme for external resources (like http://)
    $.md.prepareLink = function(link, options) {
        options = options || {};
        var ownProtocol = window.location.protocol;

        if (options.forceSSL)
            return 'https://' + link;
        if (options.forceHTTP)
            return 'http://' + link;

        if (ownProtocol === 'file:') {
            return 'http://' + link;
        }
        // default: use the same as origin resource
        return '//' + link;
    };

    if (typeof String.prototype.startsWith !== 'function') {
        String.prototype.startsWith = function(str) {
            return this.slice(0, str.length) === str;
        };
    }
    if (typeof String.prototype.endsWith !== 'function') {
        String.prototype.endsWith = function(str) {
            return this.slice(this.length - str.length, this.length) === str;
        };
    }

    $.fn.extend ({
        toptext: function () {
            return this.clone().children().remove().end().text();
        }
    });

    // adds a :icontains selector to jQuery that is case insensitive
    $.expr[':'].icontains = $.expr.createPseudo(function(arg) {
        return function(elem) {
            return $(elem).toptext().toUpperCase().indexOf(arg.toUpperCase()) >= 0;
        };
    });

    $.md.util.getInpageAnchorText = function (text) {
        var subhash = text.replace(/ /g, '_');
        // TODO remove more unwanted characters like ?/,- etc.
        return subhash;

    };
    $.md.util.getInpageAnchorHref = function (text, href) {
        href = href || $.md.mainHref;
        var subhash = $.md.util.getInpageAnchorText(text);
        return '#!' + href + '#' + subhash;
    };

    $.md.util.repeatUntil = function (interval, predicate, maxRepeats) {
        maxRepeats = maxRepeats || 10;
        var dfd = $.Deferred();
        function recursive_repeat (interval, predicate, maxRepeats) {
            if (maxRepeats === 0) {
                dfd.reject();
                return;
            }
            if (predicate()) {
                dfd.resolve();
                return;
            } else {
                $.md.util.wait(interval).always(function () {
                    recursive_repeat(interval, predicate, maxRepeats - 1);
                });
            }
        }
        recursive_repeat(interval, predicate, maxRepeats);
        return dfd;
    };

    // a count-down latch as in Java7.
    $.md.util.countDownLatch = function (capacity, min) {
        min = min || 0;
        capacity = (capacity === undefined)? 1 : capacity ;
        var dfd = $.Deferred();
        if (capacity <= min) dfd.resolve();
        dfd.capacity = capacity;
        dfd.countDown = function () {
            dfd.capacity--;
            if (dfd.capacity <= min){
                dfd.resolve();
            }
        };
        return dfd;
    };

}(jQuery));

(function($) {
    var publicMethods = {
        createBasicSkeleton: function() {

            setPageTitle();
            wrapParagraphText();
            linkImagesToSelf();
            groupImages();
            removeBreaks();
            addInpageAnchors ();

            $.md.stage('all_ready').subscribe(function(done) {
                if ($.md.inPageAnchor !== '') {
                    $.md.util.wait(500).then(function () {
                        $.md.scrollToInPageAnchor($.md.inPageAnchor);
                    });
                }
                done();
            });
            return;

        }
    };
    $.md.publicMethods = $.extend ({}, $.md.publicMethods, publicMethods);

    // set the page title to the browser document title, optionally picking
    // the first h1 element as title if no title is given
    function setPageTitle() {
        var $pageTitle;
        if ($.md.config.title)
            $('title').text($.md.config.title);

        $pageTitle = $('#md-content h1').eq(0);
        if ($.trim($pageTitle.toptext()).length > 0) {
            $('#md-title').prepend($pageTitle);
            var title = $pageTitle.toptext();
            // document.title = title;
        } else {
            $('#md-title').remove();
        }
    }
    function wrapParagraphText () {
        // TODO is this true for marked.js?

        // markdown gives us sometime paragraph that contain child tags (like img),
        // but the containing text is not wrapped. Make sure to wrap the text in the
        // paragraph into a <div>

		// this also moves ANY child tags to the front of the paragraph!
		$('#md-content p').each (function () {
			var $p = $(this);
			// nothing to do for paragraphs without text
			if ($.trim($p.text ()).length === 0) {
				// make sure no whitespace are in the p and then exit
				//$p.text ('');
				return;
			}
			// children elements of the p
            var children = $p.contents ().filter (function () {
                var $child =  $(this);
                // we extract images and hyperlinks with images out of the paragraph
                if (this.tagName === 'A' && $child.find('img').length > 0) {
                    return true;
                }
                if (this.tagName === 'IMG') {
                    return true;
                }
                // else
                return false;
            });
            var floatClass = getFloatClass($p);
            $p.wrapInner ('<div class="md-text" />');

            // if there are no children, we are done
            if (children.length === 0) {
                return;
            }
            // move the children out of the wrapped div into the original p
            children.prependTo($p);

            // at this point, we now have a paragraph that holds text AND images
            // we mark that paragraph to be a floating environment
            // TODO determine floatenv left/right
            $p.addClass ('md-floatenv').addClass (floatClass);
		});
	}
	function removeBreaks (){
		// since we use non-markdown-standard line wrapping, we get lots of
		// <br> elements we don't want.

        // remove a leading <br> from floatclasses, that happen to
        // get insertet after an image
        $('.md-floatenv').find ('.md-text').each (function () {
            var $first = $(this).find ('*').eq(0);
            if ($first.is ('br')) {
                $first.remove ();
            }
        });

        // remove any breaks from image groups
        $('.md-image-group').find ('br').remove ();
    }
	function getFloatClass (par) {
		var $p = $(par);
		var floatClass = '';

		// reduce content of the paragraph to images
		var nonTextContents = $p.contents().filter(function () {
			if (this.tagName === 'IMG' || this.tagName === 'IFRAME') {
                return true;
            }
			else if (this.tagName === 'A') {
                return $(this).find('img').length > 0;
            }
			else {
				return $.trim($(this).text ()).length > 0;
			}
		});
		// check the first element - if its an image or a link with image, we go left
		var elem = nonTextContents[0];
		if (elem !== undefined && elem !== null) {
			if (elem.tagName === 'IMG' || elem.tagName === 'IFRAME') {
                floatClass = 'md-float-left';
            }
			else if (elem.tagName === 'A' && $(elem).find('img').length > 0) {
                floatClass = 'md-float-left';
            }
			else {
                floatClass = 'md-float-right';
            }
		}
		return floatClass;
	}
    // images are put in the same image group as long as there is
    // not separating paragraph between them
    function groupImages() {
        var par = $('p img').parents('p');
        // add an .md-image-group class to the p
        par.addClass('md-image-group');
    }

    // takes a standard <img> tag and adds a hyperlink to the image source
    // needed since we scale down images via css and want them to be accessible
    // in original format
    function linkImagesToSelf () {
        function selectNonLinkedImages () {
            // only select images that do not have a non-empty parent link
            $images = $('img').filter(function(index) {
                var $parent_link = $(this).parents('a').eq(0);
                if ($parent_link.length === 0) return true;
                var attr = $parent_link.attr('href');
                return (attr && attr.length === 0);
            });
            return $images;
        }
        var $images = selectNonLinkedImages ();
        return $images.each(function() {
            var $this = $(this);
            var img_src = $this.attr('src');
            var img_title = $this.attr('title');
            if (img_title === undefined) {
                img_title = '';
            }
            // wrap the <img> tag in an anchor and copy the title of the image
            $this.wrap('<a class="md-image-selfref" href="' + img_src + '" title="'+ img_title +'"/> ');
        });
    }

    function addInpageAnchors()
    {
        // adds a pilcrow (paragraph) character to heading with a link for the
        // inpage anchor
        function addPilcrow ($heading, href) {
            var c = $.md.config.anchorCharacter;
            var $pilcrow = $('<span class="anchor-highlight"><a>' + c + '</a></span>');
            $pilcrow.find('a').attr('href', href);
            $pilcrow.hide();

            var mouse_entered = false;
            $heading.mouseenter(function () {
                mouse_entered = true;
                $.md.util.wait(300).then(function () {
                    if (!mouse_entered) return;
                    $pilcrow.fadeIn(200);
                });
            });
            $heading.mouseleave(function () {
                mouse_entered = false;
                $pilcrow.fadeOut(200);
            });
            $pilcrow.appendTo($heading);
        }

        // adds a link to the navigation at the top of the page
        function addJumpLinkToTOC($heading) {
            if($.md.config.pageMenu && $.md.config.pageMenu.disable !== false) return;

            function supportedHeading(heading) {
                var autoAnchors = $.md.config.pageMenu.useHeadings.split(',');
                var supported = false;

                $(autoAnchors).each(function(i,e){
                    if(heading.toLowerCase() === e.toLowerCase()) {
                        supported = true;
                    }
                });

                return supported;
            }

            if(!supportedHeading($heading.prop("tagName"))) return;

            var c = $.md.config.pageMenu.returnAnchor;

            if (c === '')
                return;

            var $jumpLink = $('<a class="visible-xs visible-sm jumplink" href="#md-page-menu">' + c + '</a>');
            $jumpLink.click(function(ev) {
                ev.preventDefault();

                $('body').scrollTop($('#md-page-menu').position().top);
            });

            if ($heading.parents('#md-menu').length === 0) {
                $jumpLink.insertAfter($heading);
            }
        }

        // adds a page inline anchor to each h1,h2,h3,h4,h5,h6 element
        // which can be accessed by the headings text
        $('h1,h2,h3,h4,h5,h6').not('#md-title h1').each (function () {
            var $heading = $(this);
            $heading.addClass('md-inpage-anchor');
            var text = $heading.clone().children('.anchor-highlight').remove().end().text();
            var href = $.md.util.getInpageAnchorHref(text);
            addPilcrow($heading, href);

            //add jumplink to table of contents
            addJumpLinkToTOC($heading);
        });
    }

    $.md.scrollToInPageAnchor = function(anchortext) {
        if (anchortext.startsWith ('#'))
            anchortext = anchortext.substring (1, anchortext.length);
        // we match case insensitive
        var doBreak = false;
        $('.md-inpage-anchor').each (function () {
            if (doBreak) { return; }
            var $this = $(this);
            // don't use the text of any subnode
            var text = $this.toptext();
            var match = $.md.util.getInpageAnchorText (text);
            if (anchortext === match) {
                this.scrollIntoView (true);
                var navbar_offset = $('.navbar-collapse').height() + 5;
                window.scrollBy(0, -navbar_offset + 5);
                doBreak = true;
            }
        });
    };

}(jQuery));

(function($) {
    'use strict';
    // call the gimmick
    $.mdbootstrap = function (method){
        if ($.mdbootstrap.publicMethods[method]) {
            return $.mdbootstrap.publicMethods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else {
            $.error('Method ' + method + ' does not exist on jquery.mdbootstrap');
        }
    };
    // simple wrapper around $().bind
    $.mdbootstrap.events = [];
    $.mdbootstrap.bind =  function (ev, func) {
        $(document).bind (ev, func);
        $.mdbootstrap.events.push (ev);
    };
    $.mdbootstrap.trigger = function (ev) {
        $(document).trigger (ev);
    };

    var navStyle = '';

    // PUBLIC API functions that are exposed
    var publicMethods = {
        bootstrapify: function () {
            parseHeader();
            createPageSkeleton();
            buildMenu ();
            changeHeading();
            replaceImageParagraphs();

            $('table').addClass('table').addClass('table-bordered');
            //pullRightBumper ();

            // remove the margin for headings h1 and h2 that are the first
            // on page
            //if (navStyle == "sub" || (navStyle == "top" && $('#md-title').text ().trim ().length === 0))
            //    $(".md-first-heading").css ("margin-top", "0");

            // external content should run after gimmicks were run
            $.md.stage('pregimmick').subscribe(function(done) {
                if ($.md.config.useSideMenu !== false) {
                    createPageContentMenu();
                }
                addFooter();
                addAdditionalFooterText();
                done();
            });
            $.md.stage('postgimmick').subscribe(function(done) {
                adjustExternalContent();
                highlightActiveLink();

                done();
            });
        }
    };
    // register the public API functions
    $.mdbootstrap.publicMethods = $.extend ({}, $.mdbootstrap.publicMethods, publicMethods);

    // PRIVATE FUNCTIONS:

    function parseHeader() {
        if ($.md.config.parseHeader) {
            var parsedHeaders = {};
            var header = $('#md-content > pre:first-child');
            header.hide();
            var headerLines = header.text().split("\n");
            $.each(headerLines, function(n, elem) {
                elem = elem.split(':', 2);
                if (elem.length === 2) {
                    parsedHeaders[elem[0].trim()] = elem[1].trim();
                }
            });
            parsedHeaders.title = parsedHeaders.title || $('#md-title h1').text();
            if (parsedHeaders.title) {
                document.title = parsedHeaders.title;
                $('meta[name=subject]').attr('content', parsedHeaders.title);
            }
            if (parsedHeaders.author) $('meta[name=author]').attr('content', parsedHeaders.author);
            if (parsedHeaders.description) $('meta[name=description]').attr('content', parsedHeaders.description);
            if (parsedHeaders.copyright) $('meta[name=copyright]').attr('content', parsedHeaders.copyright);
            if (parsedHeaders.keywords) $('meta[name=keywords]').attr('content', parsedHeaders.keywords);
            $('meta[name=generator]').attr('content', 'mdwiki');
        }
    }

    function buildTopNav() {
        // replace with the navbar skeleton
        if ($('#md-menu').length <= 0) {
            return;
        }
        navStyle = 'top';
        var $menuContent = $('#md-menu').children();

        // $('#md-menu').addClass ('navbar navbar-default navbar-fixed-top');
        // var menusrc = '';
        // menusrc += '<div id="md-menu-inner" class="container">';
        // menusrc += '<ul id="md-menu-ul" class="nav navbar-nav">';
        // menusrc += '</ul></div>';

        var navbar = '';
        navbar += '<div id="md-main-navbar" class="navbar navbar-default navbar-fixed-top" role="navigation">';
        navbar +=   '<div class="navbar-header">';
        navbar +=     '<button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-ex1-collapse">';
        navbar +=       '<span class="sr-only">Toggle navigation</span>';
        navbar +=       '<span class="icon-bar"></span>';
        navbar +=       '<span class="icon-bar"></span>';
        navbar +=       '<span class="icon-bar"></span>';
        navbar +=     '</button>';
        navbar +=     '<a class="navbar-brand" href="#"></a>';
        navbar +=   '</div>';

        navbar +=   '<div class="collapse navbar-collapse navbar-ex1-collapse">';
        navbar +=     '<ul class="nav navbar-nav" />';
        navbar +=     '<ul class="nav navbar-nav navbar-right" />';
        navbar +=   '</div>';
        navbar += '</div>';
        var $navbar = $(navbar);

        $navbar.appendTo('#md-menu');
        // .eq(0) becase we dont want navbar-right to be appended to
        $('#md-menu ul.nav').eq(0).append($menuContent);

        // the menu should be the first element in the body
        $('#md-menu').prependTo ('#md-all');

        var brand_text = $('#md-menu h1').toptext();
        $('#md-menu h1').remove();
        $('a.navbar-brand').text(brand_text);

        // initial offset
        $('#md-body').css('margin-top', '70px');
        $.md.stage('pregimmick').subscribe(function (done) {
            check_offset_to_navbar();
            done();
        });
    }
    // the navbar has different height depending on theme, number of navbar entries,
    // and window/device width. Therefore recalculate on start and upon window resize
    function set_offset_to_navbar () {
        var height = $('#md-main-navbar').height() + 10;
        $('#md-body').css('margin-top', height + 'px');
    }
    function check_offset_to_navbar () {
        // HACK this is VERY UGLY. When an external theme is used, we don't know when the
        // css style will be finished loading - and we can only correctly calculate
        // the height AFTER it has completely loaded.
        var navbar_height = 0;

        var dfd1 = $.md.util.repeatUntil(40, function() {
            navbar_height = $('#md-main-navbar').height();
            return (navbar_height > 35) && (navbar_height < 481);
        }, 25);

        dfd1.done(function () {
            navbar_height = $('#md-main-navbar').height();
            set_offset_to_navbar();
            // now bootstrap changes this maybe after a while, again watch for changes
            var dfd2 = $.md.util.repeatUntil(20, function () {
                return navbar_height !== $('#md-main-navbar').height();
            }, 25);
            dfd2.done(function() {
                // it changed, so we need to change it again
                set_offset_to_navbar();
            });
            // and finally, for real slow computers, make sure it is changed if changin very late
            $.md.util.wait(2000).done(function () {
                set_offset_to_navbar();
            });
        });
    }
    function buildSubNav() {
        // replace with the navbar skeleton
        /* BROKEN CODE
        if ($('#md-menu').length <= 0) {
            return;
        }
        navStyle = 'sub';
        var $menuContent = $('#md-menu').html ();

        var menusrc = '';
        menusrc += '<div id="md-menu-inner" class="subnav">';
        menusrc += '<ul id="md-menu-ul" class="nav nav-pills">';
        menusrc += $menuContent;
        menusrc += '</ul></div>';
        $('#md-menu').empty();
        $('#md-menu').wrapInner($(menusrc));
        $('#md-menu').addClass ('col-md-12');

        $('#md-menu-container').insertAfter ($('#md-title-container'));
        */
    }

    function buildMenu () {
        if ($('#md-menu a').length === 0) {
            return;
        }
        var h = $('#md-menu');

        // make toplevel <a> a dropdown
        h.find('> a[href=""]')
            .attr('data-toggle', 'dropdown')
            .addClass('dropdown-toggle')
            .attr('href','')
            .append('<b class="caret"/>');
        h.find('ul').addClass('dropdown-menu');
        h.find('ul li').addClass('dropdown');

        // replace hr with dividers
        $('#md-menu hr').each(function(i,e) {
            var hr = $(e);
            var prev = hr.prev();
            var next = hr.next();
            if (prev.is('ul') && prev.length >= 0) {
                prev.append($('<li class="divider"/>'));
                hr.remove();
                if (next.is('ul')) {
                    next.find('li').appendTo(prev);
                    next.remove();
                }
                // next ul should now be empty
            }
            return;
        });

        // remove empty uls
        $('#md-menu ul').each(function(i,e) {
            var ul = $(e);
            if (ul.find('li').length === 0) {
                ul.remove();
            }
        });

        $('#md-menu hr').replaceWith($('<li class="divider-vertical"/>'));


        // wrap the toplevel links in <li>
        $('#md-menu > a').wrap('<li />');
        $('#md-menu ul').each(function(i,e) {
            var ul = $(e);
            ul.appendTo(ul.prev());
            ul.parent('li').addClass('dropdown');
        });

        // submenu headers
        $('#md-menu li.dropdown').find('h1, h2, h3').each(function(i,e) {
            var $e = $(e);
            var text = $e.toptext();
            var header = $('<li class="dropdown-header" />');
            header.text(text);
            $e.replaceWith(header);
        });

        // call the user specifed menu function
        buildTopNav();
    }
    function isVisibleInViewport(e) {
        var el = $(e);
        var top = $(window).scrollTop();
        var bottom = top + $(window).height();

        var eltop = el.offset().top;
        var elbottom = eltop + el.height();

        return (elbottom <= bottom) && (eltop >= top);
    }

    function createPageContentMenu () {
        // assemble the menu
        var $headings = $('#md-content').find($.md.config.pageMenu.useHeadings);

        $headings.children().remove();

        if ($headings.length <= 1) {
            return;
        }

        $('#md-content').removeClass ('col-md-12');
        $('#md-content').addClass ('col-md-9');
        $('#md-content-row').prepend('<div class="col-md-3" id="md-left-column"/>');

        var recalc_width = function () {
            // if the page menu is affixed, it is not a child of the
            // <md-left-column> anymore and therefore does not inherit
            // its width. On every resize, change the class accordingly
            var width_left_column = $('#md-left-column').css('width');
            $('#md-page-menu').css('width', width_left_column);
        };

        $(window).scroll(function() {
            recalc_width($('#md-page-menu'));
            var $first;
            $('*.md-inpage-anchor').each(function(i,e) {
                if ($first === undefined) {
                    var h = $(e);
                    if (isVisibleInViewport(h)) {
                        $first = h;
                    }
                }
            });
            // highlight in the right menu
            $('#md-page-menu a').each(function(i,e) {
                var $a = $(e);
                if ($first && $a.toptext() === $first.toptext()) {
                    $('#md-page-menu a.active').removeClass('active');
                    //$a.parent('a').addClass('active');
                    $a.addClass('active');
                }
            });
        });


        var affixDiv = $('<div id="md-page-menu" />');

        //var top_spacing = $('#md-menu').height() + 15;
        var top_spacing = 70;
        affixDiv.affix({
            //offset: affix.position() - 50,
            offset: 130
        });
        affixDiv.css('top', top_spacing);
        //affix.css('top','-250px');

        var $pannel = $('<div class="panel panel-default"><ul class="list-group"/></div>');
        var $ul = $pannel.find("ul");
        affixDiv.append($pannel);

        function createMenuItem(heading, className) {
            var $heading = $(heading);
            var $a = $('<a class="list-group-item" />');
            $a.addClass(className);
            $a.attr('href', $.md.util.getInpageAnchorHref($heading.toptext()));
            $a.click(function(ev) {
                ev.preventDefault();

                var $this = $(this);
                var anchortext = $.md.util.getInpageAnchorText($this.toptext());
                $.md.scrollToInPageAnchor(anchortext);
            });
            $a.text($heading.toptext());
            return $a;
        }

        $($headings).each(function(i,e) {
            var hClass = $(e).prop('tagName');
            var currLevel = parseInt(hClass.substr(1,1), 10);
            var $hli = createMenuItem(e, hClass.toLowerCase() + '-nav');

            $ul.append($hli);
        });

        $(window).resize(function () {
            recalc_width($('#md-page-menu'));
            check_offset_to_navbar();
        });
        $.md.stage('postgimmick').subscribe(function (done) {
            // recalc_width();
            done();
        });

        //menu.css('width','100%');
        $('#md-left-column').append(affixDiv);

    }

    function createPageSkeleton() {

        $('#md-title').wrap('<div class="container" id="md-title-container"/>');
        $('#md-title').wrap('<div class="row" id="md-title-row"/>');

        $('#md-menu').wrap('<div class="container" id="md-menu-container"/>');
        $('#md-menu').wrap('<div class="row" id="md-menu-row"/>');

        $('#md-content').wrap('<div class="container" id="md-content-container"/>');
        $('#md-content').wrap('<div class="row" id="md-content-row"/>');

        $('#md-body').wrap('<div class="container" id="md-body-container"/>');
        $('#md-body').wrap('<div class="row" id="md-body-row"/>');

        $('#md-title').addClass('col-md-12');
        $('#md-content').addClass('col-md-12');

    }
    function pullRightBumper (){
 /*     $("span.bumper").each (function () {
			$this = $(this);
			$this.prev().addClass ("pull-right");
		});
		$('span.bumper').addClass ('pull-right');
*/
    }

    function changeHeading() {

        // HEADING
        var jumbo = $('<div class="page-header" />');
        $('#md-title').wrapInner(jumbo);
    }

    function highlightActiveLink () {
        // when no menu is used, return
        if ($('#md-menu').find ('li').length === 0) {
            return;
        }
		var filename = window.location.hash;

		if (filename.length === 0) {
            filename = '#!index.md';
        }
		var selector = 'li:has(a[href="' + filename + '"])';
		$('#md-menu').find (selector).addClass ('active');
    }

    // replace all <p> around images with a <div class="thumbnail" >
    function replaceImageParagraphs() {

        // only select those paragraphs that have images in them
        var $pars = $('p img').parents('p');
        $pars.each(function() {
            var $p = $(this);
            var $images = $(this).find('img')
                .filter(function() {
                    // only select those images that have no parent anchor
                    return $(this).parents('a').length === 0;
                })
                // add those anchors including images
                .add($(this).find ('img'))
                .addClass('img-responsive')
                .addClass('img-thumbnail');

            // create a new url group at the fron of the paragraph
            //$p.prepend($('<ul class="thumbnails" />'));
            // move the images to the newly created ul
            //$p.find('ul').eq(0).append($images);

            // wrap each image with a <li> that limits their space
            // the number of images in a paragraphs determines thei width / span

            // if the image is a link, wrap around the link to avoid
            function wrapImage ($imgages, wrapElement) {
                return $images.each(function (i, img) {
                    var $img = $(img);
                    var $parent_img = $img.parent('a');
                    if ($parent_img.length > 0)
                        $parent_img.wrap(wrapElement);
                    else
                        $img.wrap(wrapElement);
                });
            }

            if ($p.hasClass ('md-floatenv')) {
                if ($images.length === 1) {
                    wrapImage($images, '<div class="col-sm-8" />');
                } else if ($images.length === 2) {
                    wrapImage($images, '<div class="col-sm-4" />');
                } else {
                    wrapImage($images, '<div class="col-sm-2" />');
                }
            } else {

                // non-float => images are on their own single paragraph, make em larger
                // but remember, our image resizing will make them only as large as they are
                // but do no upscaling
                // TODO replace by calculation

                if ($images.length === 1) {
                    wrapImage($images, '<div class="col-sm-12" />');
                } else if ($images.length === 2) {
                    wrapImage($images, '<div class="col-sm-6" />');
                } else if ($images.length === 3) {
                    wrapImage($images, '<div class="col-sm-4" />');
                } else if ($images.length === 4) {
                    wrapImage($images, '<div class="col-sm-3" />');
                } else {
                    wrapImage($images, '<div class="col-sm-2" />');
                }
            }
            $p.addClass('row');
            // finally, every img gets its own wrapping thumbnail div
            //$images.wrap('<div class="thumbnail" />');
        });

        // apply float to the ul thumbnails
        //$('.md-floatenv.md-float-left ul').addClass ('pull-left');
        //$('.md-floatenv.md-float-right ul').addClass ('pull-right');
    }

    function adjustExternalContent() {
        // external content are usually iframes or divs that are integrated
        // by gimmicks
        // example: youtube iframes, google maps div canvas
        // all external content are in the md-external class

        $('iframe.md-external').not ('.md-external-nowidth')
            .attr('width', '450')
            .css ('width', '450px');

        $('iframe.md-external').not ('.md-external-noheight')
            .attr('height', '280')
            .css ('height', '280px');

        // make it appear like an image thumbnal
        //$('.md-external').addClass('img-thumbnail');

        //.wrap($("<ul class='thumbnails' />")).wrap($("<li class='col-md-6' />"));
        $('div.md-external').not('.md-external-noheight')
            .css('height', '280px');
        $('div.md-external').not('.md-external-nowidth')
            .css('width', '450px');

        // // make it appear like an image thumbnal
        // $("div.md-external").addClass("thumbnail").wrap($("<ul class='thumbnails' />")).wrap($("<li class='col-md-10' />"));

        // $("div.md-external-large").css('width', "700px")
    }

    // note: the footer is part of the GPLv3 legal information
    // and may not be removed or hidden to comply with licensing conditions.
    function addFooter() {
        var navbar = '';
        navbar += '<hr><div class="scontainer">';
        navbar +=   '<div class="pull-right md-copyright-footer"> ';
        navbar +=     '<span id="md-footer-additional"></span>';
        navbar +=     'Website generated with <a href="http://www.mdwiki.info">MDwiki</a> ';
        navbar +=     '&copy; Timo D&ouml;rr and contributors. ';
        navbar +=   '</div>';
        navbar += '</div>';
        var $navbar = $(navbar);
        $navbar.css('position', 'relative');
        $navbar.css('margin-top', '1em');
        $('#md-all').append ($navbar);
    }

    function addAdditionalFooterText () {
        var text = $.md.config.additionalFooterText;
        if (text) {
            $('.md-copyright-footer #md-footer-additional').html(text);
        }
    }
}(jQuery));

(function($) {
    //'use strict';
    var alertsModule = new MDwiki.Core.Module();
    alertsModule.init = function() {
        $.md.stage('bootstrap').subscribe(function(done) {
            createAlerts();
            done();
        });
    };
    $.md.wiki.gimmicks.registerModule(alertsModule);

    // takes a standard <img> tag and adds a hyperlink to the image source
    // needed since we scale down images via css and want them to be accessible
    // in original format
    function createAlerts() {
        var matches = $(select_paragraphs());
        matches.each(function() {
            var $p = $(this.p);
            var type = this.alertType;
            $p.addClass('alert');

            if (type === 'note') {
                $p.addClass('alert-info');
            } else if (type === 'hint') {
                $p.addClass('alert-success');
            } else if (type === 'warning') {
                $p.addClass('alert-warning');
            }
        });
    }

    // picks out the paragraphs that start with a trigger word
    function select_paragraphs() {
        var note = ['note', 'beachte' ];
        var warning = [ 'achtung', 'attention', 'warnung', 'warning', 'atención', 'guarda', 'advertimiento' ];
        var hint = ['hint', 'tipp', 'tip', 'hinweis'];
        var exp = note.concat(warning);
        exp = exp.concat(hint);
        var matches = [];

        $('p').filter (function () {
            var $par = $(this);
            // check against each expression
            $(exp).each (function (i,trigger) {
                var txt = $par.text().toLowerCase ();
                // we match only paragrachps in which the 'trigger' expression
                // is follow by a ! or :
                var re = new RegExp (trigger + '(:|!)+.*','i');
                var alertType = 'none';
                if (txt.match (re) !== null) {
                    if ($.inArray(trigger, note) >= 0) {
                        alertType = 'note';
                    } else if ($.inArray(trigger, warning) >= 0) {
                        alertType = 'warning';
                    } else if ($.inArray(trigger, hint) >= 0) {
                        alertType = 'hint';
                    }
                    matches.push ({
                        p: $par,
                        alertType: alertType
                    });
                }
            });
        });
        return matches;
    }
}(jQuery));

(function($) {
    // makes trouble, find out why
    //'use strict';
    var colorboxModule = new MDwiki.Core.Module();
    colorboxModule.init = function() {
        $.md.stage('gimmick').subscribe(function(done) {
            make_colorbox();
            done();
        });
    };
    $.md.wiki.gimmicks.registerModule(colorboxModule);

    function make_colorbox() {
        var $image_groups;
        if (!(this instanceof jQuery)) {
            // select the image groups of the page
            $image_groups = $('.md-image-group');
        } else {
            $image_groups = $(this);
        }
        // operate on md-image-group, which holds one
        // or more images that are to be colorbox'ed
        var counter = 0;
        return $image_groups.each(function() {
            var $this = $(this);

            // each group requires a unique name
            var gal_group = 'gallery-group-' + (counter++);

            // create a hyperlink around the image
            $this.find('a.md-image-selfref img')
            // filter out images that already are a hyperlink
            // (so won't be part of the gallery)

            // apply colorbox on their parent anchors
            .parents('a').colorbox({
                rel: gal_group,
                opacity: 0.75,
                slideshow: true,
                maxWidth: '95%',
                maxHeight: '95%',
                scalePhotos: true,
                photo: true,
                slideshowAuto: false
            });
        });
    }
}(jQuery));

(function($) {

    var alreadyDone = false;
    function disqus ($links, opt, text) {
        var default_options = {
            identifier: ''
        };
        var options = $.extend (default_options, opt);
        var disqus_div = $('<div id="disqus_thread" class="md-external md-external-noheight md-external-nowidth" >' + '<a href="http://disqus.com" class="dsq-brlink">comments powered by <span class="logo-disqus">Disqus</span></a></div>');
        disqus_div.css ('margin-top', '2em');
        return $links.each(function(i,link) {
            if (alreadyDone === true) {
                return;
            }
            alreadyDone = true;

            var $link = $(link);
            var disqus_shortname = $link.attr('href');

            if (disqus_shortname !== undefined && disqus_shortname.length > 0) {
                // insert the div
                $link.remove ();
                // since disqus need lot of height, always but it on the bottom of the page
                $('#md-content').append(disqus_div);
                if ($('#disqus_thread').length > 0) {
                    (function() {
                        // all disqus_ variables are used by the script, they
                        // change the config behavious.
                        // see: http://help.disqus.com/customer/portal/articles/472098-javascript-configuration-variables

                        // set to 1 if developing, or the site is password protected or not
                        // publicaly accessible
                        //var disqus_developer = 1;

                        // by default, disqus will use the current url to determine a thread
                        // since we might have different parameters present, we remove them
                        // disqus_* vars HAVE TO BE IN GLOBAL SCOPE
                        var disqus_url = window.location.href;
                        var disqus_identifier;
                        if (options.identifier.length > 0) {
                            disqus_identifier = options.identifier;
                        } else {
                            disqus_identifier = disqus_url;
                        }

                        // dynamically load the disqus script
                        var dsq = document.createElement('script');
                        dsq.type = 'text/javascript';
                        dsq.async = true;
                        dsq.src = 'http://' + disqus_shortname + '.disqus.com/embed.js';
                        (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);
                    })();
                }
            }
        });
    }

    var disqusGimmick = new MDwiki.Core.Gimmick();
    disqusGimmick.addHandler('disqus', disqus);
    $.md.wiki.gimmicks.registerGimmick(disqusGimmick);
}(jQuery));

(function($){
    'use strict';

    function editMe($links, opt, href) {
        opt.text = opt.text || 'Edit Me';
        if (!href.endsWith('/'))
            href += '/';
        return $links.each(function(i,link) {
            $(link)
                .text(opt.text)
                .attr('href', href + $.md.mainHref)
                .addClass('editme')
                .prepend('<i class="glyphicon glyphicon-pencil"></i> ');
        });
    }
    var editMeGimmick = new MDwiki.Core.Gimmick();
    editMeGimmick.addHandler('editme', editMe);
    $.md.wiki.gimmicks.registerGimmick(editMeGimmick);
}(jQuery));

(function($) {
    var language = window.navigator.userLanguage || window.navigator.language;
    var code = language + "_" + language.toUpperCase();
    var fbRootDiv = $('<div id="fb-root" />');
    var fbScriptHref = $.md.prepareLink ('connect.facebook.net/' + code + '/all.js#xfbml=1', { forceHTTP: true });
    var fbscript ='(function(d, s, id) { var js, fjs = d.getElementsByTagName(s)[0]; if (d.getElementById(id)) return; js = d.createElement(s); js.id = id; js.src = "' + fbScriptHref + '"; fjs.parentNode.insertBefore(js, fjs);}(document, "script", "facebook-jssdk"));';


    function facebooklike($link, opt, text) {
        var default_options = {
            layout: 'standard',
            showfaces: true
        };
        var options = $.extend ({}, default_options, opt);
        // Due to a bug, we can have underscores _ in a markdown link
        // so we insert the underscores needed by facebook here
        if (options.layout === 'boxcount') {
            options.layout = 'box_count';
        }
        if (options.layout === 'buttoncount') {
            options.layout = 'button_count';
        }

        return $link.each(function(i,e) {
            var $this = $(e);
            var href = $this.attr('href');
            $('body').append(fbRootDiv);

            var $fb_div = $('<div class="fb-like" data-send="false" data-width="450"></div>');
            $fb_div.attr ('data-href', href);
            $fb_div.attr ('data-layout', options.layout);
            $fb_div.attr ('data-show-faces', options.showfaces);

            $this.replaceWith ($fb_div);
        });
    }

    var facebookLikeGimmick = new MDwiki.Core.Gimmick();
    facebookLikeGimmick.addHandler('facebooklike', facebooklike);
    facebookLikeGimmick.init = function () {
        // license: 'APACHE2',
        var the_script = new MDwiki.Core.ScriptResource(fbscript, 'postgimmick', 'all_ready');
        this.registerScriptResource(the_script);
    };
    $.md.wiki.gimmicks.registerGimmick(facebookLikeGimmick);
}(jQuery));

(function($) {
    'use strict';
    function forkmeongithub($links, opt, text) {
        return $links.each (function (i, link){
            var $link = $(link);
            // default options
            var default_options = {
                color: 'red',
                position : 'right'
            };
            var options = $.extend ({}, default_options, opt);
            var color = options.color;
            var pos = options.position;

            // the filename for the ribbon
            // see: https://github.com/blog/273-github-ribbons
            var base_href = 'https://s3.amazonaws.com/github/ribbons/forkme_';

            if (color === 'red') {
                base_href += pos + '_red_aa0000.png';
            }
            if (color === 'green') {
                base_href += pos + '_green_007200.png';
            }
            if (color === 'darkblue') {
                base_href += pos + '_darkblue_121621.png';
            }
            if (color === 'orange') {
                base_href += pos + '_orange_ff7600.png';
            }
            if (color === 'white') {
                base_href += pos + '_white_ffffff.png';
            }
            if (color === 'gray') {
                base_href += pos + '_gray_6d6d6d.png';
            }

            var href = $link.attr('href');
    //                var body_pos_top = $('#md-body').offset ().top;
            var body_pos_top = 0;
            var github_link = $('<a class="forkmeongithub" href="'+ href +'"><img style="position: absolute; top: ' + body_pos_top + ';'+pos+': 0; border: 0;" src="'+base_href+'" alt="Fork me on GitHub"></a>');
            // to avoid interfering with other div / scripts, we remove the link and prepend it to the body
            // the fork me ribbon is positioned absolute anyways
            $('body').prepend (github_link);
            github_link.find('img').css ('z-index', '2000');
            $link.remove();
        });
    }

    var gimmick = new MDwiki.Core.Gimmick();
    gimmick.addHandler('forkmeongithub', forkmeongithub);
    $.md.wiki.gimmicks.registerGimmick(gimmick);

}(jQuery));

(function($){
    'use strict';

    function gist($links, opt, href) {
        $().lazygist('init');
        return $links.each(function(i,link) {
            var $link = $(link);
            var gistDiv = $('<div class="gist_here" data-id="' + href + '" />');
            $link.replaceWith(gistDiv);
            gistDiv.lazygist({
                // we dont want a specific file so modify the url template
                url_template: 'https://gist.github.com/{id}.js?'
            });
        });
    }

    var gistGimmick = new MDwiki.Core.Gimmick();
    gistGimmick.addHandler('gist', gist);
    $.md.wiki.gimmicks.registerGimmick(gistGimmick);
}(jQuery));


 /**
 * Lazygist v0.2pre
 *
 * a jQuery plugin that will lazy load your gists.
 *
 * since jQuery 1.7.2
 * https://github.com/tammo/jquery-lazy-gist
 *
 * Copyright, Tammo Pape
 * http://tammopape.de
 *
 * Licensed under the MIT license.
 */

(function( $, window, document, undefined ){
    "use strict";

    //
    // note:
    // this plugin is not stateful
    // and will not communicate with own instances at different elements
    //

    var pluginName = "lazygist",
    version = "0.2pre",

    defaults = {
        // adding the ?file parameter to choose a file
        'url_template': 'https://gist.github.com/{id}.js?file={file}',

        // if these are strings, the attributes will be read from the element
        'id': 'data-id',
        'file': 'data-file'
    },

    options,

    // will be replaced
    /*jshint -W060 */
    originwrite = document.write,

    // stylesheet urls found in document.write calls
    // they are cached to write them once to the document,
    // not three times for three gists
    stylesheets = [],

    // cache gist-ids to know which are already appended to the dom
    ids_dom = [],

    // remember gist-ids if their javascript is already loaded
    ids_ajax = [],

    methods = {

        /**
         * Standard init function
         * No magic here
         */
        init : function( options_input ){

            // default options are default
            options = $.extend({}, defaults, options_input);

            // can be reset
            /*jshint -W061 */
            document.write = _write;

            $.each(options, function(index, value) {
                if(typeof value !== 'string') {
                    throw new TypeError(value + ' (' + (typeof value) + ') is not a string');
                }
            });

            return this.lazygist('load');
        },

        /**
         * Load the gists
         */
        load : function() {
            // (1) iterate over gist anchors
            // (2) append the gist-html through the new document.write func (see _write)

            // (1)
            return this.filter('[' + options.id + ']').each(function(){

                var id = $(this).attr(options.id),
                    file = $(this).attr(options.file),
                    src;

                if( id !== undefined ) {

                    if( $.inArray(id, ids_ajax) !== -1 ) {
                        // just do nothin, if gist is already ajaxed
                        return;
                    }

                    ids_ajax.push(id);

                    src = options.url_template.replace(/\{id\}/g, id).replace(/\{file\}/g, file);

                    // (2) this will trigger our _write function
                    $.getScript(src, function() {
                    });
                }
            });
        },

        /**
         * Just reset the write function
         */
        reset_write: function() {
            document.write = originwrite;

            return this;
        }
    };

    /**
     * private special document.write function
     *
     * Filters the css file from github.com to add it to the head - once -
     *
     * It has a fallback to keep flexibility with other scripts as high as possible
     * (create a ticket if it messes things up!)
     *
     * Keep in mind, that a call to this function happens after
     * an ajax call by jQuery. One *cannot* know which gist-anchor
     * to use. You can only read the id from the content.
     */
    function _write( content ) {

        var expression, // for regexp results
            href, // from the url
            id; // from the content

        if( content.indexOf( 'rel="stylesheet"' ) !== -1 ) {
            href = $(content).attr('href');

            // check if stylesheet is already inserted
            if ( $.inArray(href, stylesheets) === -1 ) {

                $('head').append(content);
                stylesheets.push(href);
            }

        } else if( content.indexOf( 'id="gist' ) !== -1 ) {
            expression = /https:\/\/gist.github.com\/.*\/(.*)#/.exec(content);
            id = expression[1];

            if( id !== undefined ) {

                // test if id is already loaded
                if( $.inArray(id, ids_dom) !== -1 ) {
                    // just do nothin, if gist is already attached to the dom
                    return;
                }

                ids_dom.push(id);

                $('.gist_here[data-id=' + id + ']').append(content);
            }
        } else {
            // this is a fallback for interoperability
            originwrite.apply( document, arguments );
        }
    }

    // method invocation - from jQuery.com
    $.fn[pluginName] = function( method ) {

        if ( methods[method] ) {
            return methods[ method ].apply( this, Array.prototype.slice.call( arguments, 1 ));

        } else if ( typeof method === 'object' || ! method ) {
            return methods.init.apply( this, arguments );

        } else {
            $.error( 'Method ' +  method + ' does not exist on jQuery.lazygist' );
        }
    };

    // expose version for your interest
    $.fn[pluginName].version = version;

})(jQuery, window, document);

// ugly, but the google loader requires the callback fn
// to be in the global scope
var googlemapsLoadDone;

function googlemapsReady() {
    googlemapsLoadDone.resolve();
}

(function($) {
    //'use strict';
    var scripturl = 'http://maps.google.com/maps/api/js?sensor=false&callback=googlemapsReady';

    function googlemaps($links, opt, text) {
        var $maps_links = $links;
        var counter = (new Date()).getTime ();
        return $maps_links.each(function(i,e) {
            var $link = $(e);
            var default_options = {
                zoom: 11,
                marker: true,
                scrollwheel: false,
                maptype: 'roadmap'
            };
            var options = $.extend({}, default_options, opt);
            if (options.address === undefined) {
                options.address = $link.attr ('href');
            }
            var div_id = 'google-map-' + Math.floor (Math.random() * 100000);
            var $mapsdiv = $('<div class="md-external md-external-nowidth" id="' + div_id + '"/>');
            /* TODO height & width must be set AFTER the theme script went through
            implement an on event, maybe?
            if (options["width"] !== undefined) {
                $mapsdiv.css('width', options["width"] + "px");
                options["width"] = null;
            }
            if (options["height"] !== undefined) {
                $mapsdiv.css('height', options["height"] + "px");
                options["height"] = null;
            }
            */
            $link.replaceWith ($mapsdiv);
            // the div is already put into the site and will be formated,
            // we can now run async
            set_map (options, div_id);
        });
    }
    function set_map(opt, div_id) {

        // google uses rather complicated mapnames, we transform our simple ones
        var mt = opt.maptype.toUpperCase ();
        opt.mapTypeId = google.maps.MapTypeId[mt];
        var geocoder = new google.maps.Geocoder ();

        // geocode performs address to coordinate transformation
        geocoder.geocode ({ address: opt.address }, function (result, status) {
            if (status !== 'OK') {
                return;
            }

            // add the retrieved coords to the options object
            var coords = result[0].geometry.location;

            var options = $.extend({}, opt, { center: coords  });
            var gmap = new google.maps.Map(document.getElementById(div_id), options);
            if (options.marker === true) {
                var marker = new google.maps.Marker ({ position: coords, map : gmap});
            }
        });
    }

    var googleMapsGimmick = new MDwiki.Core.Gimmick();
    googleMapsGimmick.init = function() {
        googlemapsLoadDone = $.Deferred();

        // googleMapsGimmick.subscribeGimmick('googlemaps', googlemaps);
        // load the googlemaps js from the google server
        var script = new MDwiki.Core.ScriptResource (scripturl, 'skel_ready', 'bootstrap');
        googleMapsGimmick.registerScriptResource(script);

        $.md.stage('bootstrap').subscribe(function(done) {
            // defer the pregimmick phase until the google script fully loaded
            googlemapsLoadDone.done(function() {
                done();
            });
        });
    };
    googleMapsGimmick.addHandler('googlemaps', googlemaps);
    $.md.wiki.gimmicks.registerGimmick(googleMapsGimmick);
}(jQuery));

(function($) {
    'use strict';

    function create_iframe($links, opt, text) {
        return $links.each (function (i, link){
            var $link = $(link);
            var href = $link.attr('href');
            var $iframe = $('<iframe class="col-md-12" style="border: 0px solid red; height: 650px;"></iframe>');
            $iframe.attr('src', href);
            $link.replaceWith($iframe);

            if (opt.width)
                $iframe.css('width', opt.width);
            if (opt.height)
                $iframe.css('height', opt.height);
            else {
                var updateSizeFn = function () {
                    var offset = $iframe.offset();
                    var winHeight = $(window).height();
                    var newHeight = winHeight - offset.top - 5;
                    $iframe.height(newHeight);
                };

                $iframe.load(function(done) {
                    updateSizeFn();
                });

                $(window).resize(function () {
                    updateSizeFn();
                });
            }

        });
    }

    var iframeGimmick = new MDwiki.Core.Gimmick();
    iframeGimmick.addHandler('iframe', create_iframe);
    $.md.wiki.gimmicks.registerGimmick(iframeGimmick);
}(jQuery));

(function($) {

    var supportedLangs = [
        'bash',
        'c',
        'coffeescript',
        'cpp',
        'csharp',
        'css',
        'go',
        'html',
        'javascript',
        'java',
        'php',
        'python',
        'ruby',
        'sass',
        'sql',
        'xml'
    ];
    function prism_highlight () {
        // marked adds lang-ruby, lang-csharp etc to the <code> block like in GFM
        var $codeblocks = $('pre code[class^=lang-]');
        $codeblocks.each(function() {
            var $this = $(this);
            var classes = $this.attr('class');
            var lang = classes.substring(5);
            if (supportedLangs.indexOf(lang) < 0) {
                return;
            }
            if (lang === 'html' || lang === 'xml') {
                lang = 'markup';
            }
            $this.removeClass(classes);
            $this.addClass('language-' + lang);
        });
        Prism.highlightAll();
    }

    var prismGimmick = new MDwiki.Core.Module();
    prismGimmick.init = function() {
        $.md.stage('gimmick').subscribe(function(done) {
            prism_highlight();
            done();
        });
    };
    $.md.wiki.gimmicks.registerModule(prismGimmick);
}(jQuery));

(function($) {
    'use strict';
    function load_mathjax() {
        // first insert configuration
        window.MathJax = {
            showProcessingMessages: false,
            tex2jax: {
                inlineMath: [ ['$$','$$']],
                displayMath: [ ['$$$','$$$']],
                processEscapes: true
            }
        };
        var url = $.md.prepareLink('cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML', { forceHTTP: true });
        var script = document.createElement('script');
        script.src = url;
        document.getElementsByTagName('head')[0].appendChild(script);
    }
    var mathGimmick = new MDwiki.Core.Module();
    mathGimmick.init = function() {
        $.md.stage('pregimmick').subscribe(function(done) {
            var $math_sections = $('.lang-math');
            var num_math_sections = $math_sections.length;
            if (num_math_sections > 0) {
                // move the content of ```math out of a <pre><code> block so
                // mathjax will process it (mathjax by default ignores <pre>).
                $math_sections.each(function(index, section) {
                    var $section = $(section);
                    var text = '$$$' + $section.text() + '$$$';
                    var div_for_mathjax = $('<div>' + text + '</div>');
                    $section.parent('pre').replaceWith(div_for_mathjax);
                });

                // load mathjax script
                load_mathjax();
            }
            done();
        });
    };
    $.md.wiki.gimmicks.registerModule(mathGimmick);

}(jQuery));

(function($) {
    //'use strict';
    function twitterfollow($links, opt, text) {
        return $links.each(function(i, link) {
            var $link = $(link);
            var user;
            var href = $link.attr('href');
            if (href.indexOf ('twitter.com') <= 0) {
                user = $link.attr('href');
                href = $.md.prepareLink('twitter.com/' + user);
            }
            else {
                return;
            }
            // remove the leading @ if given
            if (user[0] === '@') {
                user = user.substring(1);
            }
            var twitter_src = $('<a href="' + href + '" class="twitter-follow-button" data-show-count="false" data-lang="en" data-show-screen-name="false">'+ '@' + user + '</a>');
            $link.replaceWith (twitter_src);
        });
    }

    // no license information given in the widget.js -> OTHER
    var widgetHref = $.md.prepareLink('platform.twitter.com/widgets.js');
    var twitterscript = '!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="' + widgetHref + '";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");';

    var twitterGimmick = new MDwiki.Core.Gimmick();
    twitterGimmick.addHandler('twitterfollow', twitterfollow);
    twitterGimmick.init = function() {
        var script = new MDwiki.Core.ScriptResource();
        script.url = twitterscript;
        script.loadstage = 'postgimmick';
        script.finishstage = 'all_ready';
                // license: 'EXCEPTION',
        twitterGimmick.registerScriptResource(script);
    };
    $.md.wiki.gimmicks.registerGimmick(twitterGimmick);

}(jQuery));

(function($) {
    //'use strict';
    function youtubeLinkToIframe() {
        var $youtube_links = $('a[href*=youtube\\.com]:empty, a[href*=youtu\\.be]:empty');

        $youtube_links.each(function() {
            var $this = $(this);
            var href = $this.attr('href');
            if (href !== undefined) {
                // extract the v parameter from youtube
                var exp = /.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=)([^#\&\?]*).*/;
                var m = href.match(exp);

                if (m && m[1].length === 11) {
                    // insert the iframe
                    var short_handle = m[1];
                    var frame = $('<iframe class="md-external" frameborder="0" allowfullscreen></iframe>');
                    frame.attr('src', 'http://youtube.com/embed/' + short_handle);
                    // remove the a tag
                    $this.replaceWith(frame);

                }
            }
        });
    }
    var youtubeGimmick = new MDwiki.Core.Module();
    youtubeGimmick.init = function () {
        $.md.stage('gimmick').subscribe(function(done) {
            youtubeLinkToIframe();
            done();
        });
    };
    $.md.wiki.gimmicks.registerModule(youtubeGimmick);

}(jQuery));

(function($) {
    'use strict';
    function yuml($link, opt, text) {
        var default_options = {
            type: 'class',  /* { class, activity, usecase } */
            style: 'plain', /* { plain, scruffy } */
            direction: 'LR',      /* LR, TB, RL */
            scale: '100'
        };
        var options = $.extend ({}, default_options, opt);

        return $link.each(function(i,e) {

            var $this = $(e);
            var url = 'http://yuml.me/diagram/';
            var data = $this.attr('href');
            var title = $this.attr('title');

            title = (title ? title : '');

            /* `FOOBAR´ => (FOOBAR) */
            data = data.replace( new RegExp('`', 'g'), '(' ).replace( new RegExp('´', 'g'), ')' );

            url += options.style + ';dir:' + options.direction + ';scale:' + options.scale + '/' + options.type + '/' + data;

            var $img = $('<img src="' + url + '" title="' + title + '" alt="' + title + '">');

            $this.replaceWith($img);
        });
    }

    var gimmick = new MDwiki.Core.Gimmick();
    gimmick.addHandler('yuml', yuml);
    $.md.wiki.gimmicks.registerGimmick(gimmick);

}(jQuery));
