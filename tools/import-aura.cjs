// Rebuild the public web release without writing to the author's checkout.
// Usage: node tools/import-aura.cjs [--check]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const workspace = path.resolve(__dirname, '..');
const destination = path.join(workspace, 'aura');
const source = 'D:/Claude/cursed-aura-survivors';
const upstreamRequire = createRequire(path.join(source, 'build.js'));
const { minify } = upstreamRequire('terser');
const { assembleSource } = upstreamRequire('./assemble.js');
const { publicAsset, assertPublicText } = upstreamRequire('./tools/publication-security.cjs');
const textAsset = /\.(?:html|webmanifest|js|css|json|svg|txt)$/i;
const maxFileBytes = 100 * 1024 * 1024;
const hostTranslations = {
  'WASD / стрелки — движение, ESC — пауза. Собирай кристаллы опыта, чтобы усиливаться. Цель: продержись до {time} и зачисти арену стражей.': 'WASD / arrow keys to move, ESC to pause. Collect XP crystals to grow stronger. Goal: survive until {time} and clear the guardian arena.',
  'Джойстик — движение, ❙❙ вверху справа — пауза. Собирай кристаллы опыта, чтобы усиливаться. Цель: продержись до {time} и зачисти арену стражей.': 'Use the joystick to move and ❙❙ at the top right to pause. Collect XP crystals to grow stronger. Goal: survive until {time} and clear the guardian arena.'
};

// Read the actual release filter, so later imports cannot silently widen it.
const policy = fs.readFileSync(path.join(source, 'build.js'), 'utf8')
  .match(/function publishedAsset\(relative\)\{[\s\S]*?\r?\n\}/);
assert(policy, 'Upstream publication filter changed; review the importer.');
const publishedAsset = vm.runInNewContext(`(${policy[0]})`, { path });

function walk(directory, base = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    assert(!entry.isSymbolicLink(), `Refusing symlink: ${base}/${entry.name}`);
    const relative = path.posix.join(base, entry.name);
    return entry.isDirectory()
      ? walk(path.join(directory, entry.name), relative)
      : [relative];
  });
}

function publicFiles(directory, base = 'assets') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = `${base}/${entry.name}`;
    if (!publishedAsset(relative) || !publicAsset(relative, entry.isDirectory())) return [];
    assert(!entry.isSymbolicLink(), `Refusing source symlink: ${relative}`);
    return entry.isDirectory()
      ? publicFiles(path.join(directory, entry.name), relative)
      : [relative];
  });
}

function localHtml(html) {
  return html.replace(/https:\/\/sorcery-aura\.pages\.dev(?:\/about(?:\.html)?)?(?=["'])/g,
    match => match.includes('/about') ? 'about.html' : './')
    .replace(/https:\/\/sorcery-aura\.pages\.dev\/(?=["'])/g, './')
    .replace(/(["'(])\/assets\//g, '$1assets/');
}

const homeStyle = `/* Host navigation appears only in the ready main hall, away from battle controls. */
#potencevalHome{display:none;position:fixed;left:max(10px,env(safe-area-inset-left));bottom:max(10px,env(safe-area-inset-bottom));z-index:500;align-items:center;min-height:44px;padding:0 12px;border:1px solid #b9985d55;border-radius:6px;background:#0c0e16dd;color:#dccda9;font:12px/1.3 system-ui,sans-serif;text-decoration:none;touch-action:manipulation}
body:has(#mainMenu.show[data-panel="menuHome"][data-boot="ready"]) #potencevalHome{display:inline-flex}
#potencevalHome:hover,#potencevalHome:focus-visible{color:#fff0cd;border-color:#e8cc91;outline:2px solid #e8cc91;outline-offset:3px}
`;

// Seed the game's own preference before its boot guard and localization runtime read it.
const languageBootstrap = `<script data-potenceval-language>
(()=>{try{const language=localStorage.getItem('pv.lang');if(language==='en'||language==='ru')localStorage.setItem('ca.language',language);}catch(_){}})();
</script>`;

async function checkRelease() {
  const files = walk(destination);
  assert(files.length > 700, 'Release assets are incomplete.');
  const html = fs.readFileSync(path.join(destination, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(destination, 'manifest.webmanifest'), 'utf8'));
  for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], './');
  assert(html.includes('id="potencevalHome" href="../"'), 'Missing Home navigation.');
  const languageScript = html.match(/<script data-potenceval-language>([\s\S]*?)<\/script>/);
  assert(languageScript, 'Missing site language initialization.');
  assert(html.indexOf('<script data-potenceval-language>') < html.indexOf('<script data-startup>'));
  const languageRuntime = fs.readFileSync(path.join(source, 'src/i18n/runtime.js'), 'utf8');
  for (const [ru, en] of Object.entries(hostTranslations)) {
    assert(html.includes(ru), 'Missing translated objective template.');
    const translated = vm.runInNewContext(languageRuntime + '\ntText(' + JSON.stringify(ru.replace('{time}', '9:00')) + ')', {
      EN_CONTENT:{}, EN_UI:hostTranslations, EN_ACCOUNT:{}, localStorage:{getItem:()=> 'en'}
    });
    assert.equal(translated, en.replace('{time}', '9:00'));
  }
  for (const [site, game, expected] of [['en', 'ru', 'en'], ['ru', 'en', 'ru'], [null, 'en', 'en'], [null, null, 'ru'], ['unsupported', 'en', 'en']]) {
    const storage = new Map([['ca_run_v1', 'saved run'], ['ca_session_v1', 'saved session'], ['ca_sync_v1', 'saved progress']]);
    if (site !== null) storage.set('pv.lang', site);
    if (game !== null) storage.set('ca.language', game);
    const before = new Map(storage), writes = [];
    const language = vm.runInNewContext(languageScript[1] + '\n' + languageRuntime + '\ngetLanguage()', {
      EN_CONTENT: {}, EN_UI: {}, EN_ACCOUNT: {},
      localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => { writes.push(key); storage.set(key, value); } }
    });
    assert.equal(language, expected);
    assert.deepEqual(writes, site === 'en' || site === 'ru' ? ['ca.language'] : []);
    for (const [key, value] of before) if (key !== 'ca.language') assert.equal(storage.get(key), value);
  }
  assert.doesNotThrow(() => vm.runInNewContext(languageScript[1], {
    localStorage: { getItem() { throw new Error('Storage unavailable'); } }
  }));
  assert(!/serviceWorker\s*\.\s*register|sorcery-aura\.pages\.dev/.test(html));
  assert(!files.some(file => /(?:^|\/)(?:sw|service-worker)\.js$|\.(?:map|blend|sql|md)$/i.test(file)));

  const references = new Set();
  const verifyReference = (reference, owner) => {
    const clean = reference.split(/[?#]/)[0];
    if (!clean || /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(clean)) return;
    assert(!clean.startsWith('/'), `Root-relative reference in ${owner}: ${clean}`);
    if (clean === '../' && owner.endsWith('.html')) return;
    const file = path.resolve(destination, path.dirname(owner), clean);
    assert(file === destination || file.startsWith(destination + path.sep), `Reference escapes aura: ${owner}: ${clean}`);
    assert(fs.existsSync(file), `Missing reference in ${owner}: ${clean}`);
    references.add(path.relative(destination, file));
  };

  let inlineScripts = 0, bytes = 0, largest = { file: '', bytes: 0 };
  for (const relative of files) {
    const file = path.join(destination, relative), size = fs.statSync(file).size;
    assert(size < maxFileBytes, `Oversize public file: ${relative}`);
    bytes += size;
    if (size > largest.bytes) largest = { file: relative, bytes: size };
    if (relative.startsWith('assets/')) {
      assert(publishedAsset(relative) && publicAsset(relative, false), `Unpublished asset: ${relative}`);
    }
    if (!textAsset.test(relative)) continue;
    const text = fs.readFileSync(file, 'utf8');
    assertPublicText(text, relative);
    if (relative.endsWith('.json') || relative.endsWith('.webmanifest')) JSON.parse(text);
    if (relative.endsWith('.js')) {
      if (relative === 'assets/menu/parallax-v1/scene.js') await minify(text, { module: true });
      else new vm.Script(text, { filename: relative });
    }
    if (relative.endsWith('.html')) {
      for (const script of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
        if (/\bsrc\s*=/.test(script[1])) continue;
        if (/type=["']application\//i.test(script[1])) JSON.parse(script[2]);
        else new vm.Script(script[2], { filename: `${relative}:inline-${++inlineScripts}` });
      }
      // Static markup and complete literal assets also cover the CSS and boot-size table.
      const markup = text.replace(/(<script\b[^>]*>)[\s\S]*?<\/script\s*>/gi, '$1</script>');
      for (const match of markup.matchAll(/\b(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi)) {
        if (/[${}'+<>]/.test(match[1])) continue;
        verifyReference(match[1].replace(/&amp;/g, '&'), relative);
      }
    }
    if (/\.(?:html|js|json|css)$/.test(relative)) {
      const referenceText = text.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of referenceText.matchAll(/(?<![\w/.-])(?:\.\/)?assets\/[\w/.-]+\.(?:png|webp|jpe?g|gif|avif|svg|mp3|ogg|wav|mp4|webm|woff2?|ttf|otf|glb|js|json)(?=[?"'`\s)<>])/g)) {
        // Game asset literals, including hall manifest URLs, resolve from document.baseURI.
        verifyReference(match[0], 'index.html');
      }
      for (const match of referenceText.matchAll(/\burl\(\s*["']?([^\s"')]+)["']?\s*\)/g)) {
        if (/[${}+]/.test(match[1]) || /^%23/i.test(match[1])) continue;
        verifyReference(match[1], relative);
      }
    }
  }
  for (const icon of manifest.icons) verifyReference(icon.src, 'manifest.webmanifest');
  console.log(JSON.stringify({ files: files.length, bytes, largest, references: references.size, inlineScripts, security: 'passed', syntax: 'passed', scope: '/aura/' }, null, 2));
}

async function build() {
  assert.equal(path.dirname(destination), workspace);
  assert.notEqual(path.resolve(source), destination);
  const files = publicFiles(path.join(source, 'assets'));
  const sizes = {};
  for (const relative of files) {
    const file = path.join(source, relative), size = fs.statSync(file).size;
    assert(size < maxFileBytes, `Oversize source asset: ${relative}`);
    if (textAsset.test(relative)) assertPublicText(fs.readFileSync(file, 'utf8'), relative);
    if (/\.(?:png|webp|jpe?g|gif|avif|glb|svg)$/i.test(relative)) sizes[relative] = size;
  }
  const hall = await minify(fs.readFileSync(path.join(source, 'src/menu/parallax-hall.mjs'), 'utf8'), {
    module: true, compress: { passes: 2 }, mangle: true
  });
  let assembled = assembleSource(path.join(source, 'src/game.html')).replace(/\r\n/g, '\n');
  const dictionaryStart = 'const localeDictionary={...EN_CONTENT,...EN_UI,...EN_ACCOUNT,';
  assert(assembled.includes(dictionaryStart), 'Review changed localization runtime.');
  assembled = assembled.replace(dictionaryStart, dictionaryStart + '...' + JSON.stringify(hostTranslations) + ',');
  assert(assembled.includes('const YANDEX_BUILD = false;'));
  assert(assembled.includes('const INTERNAL_BUILD = false;'));
  assert(assembled.includes('const BOOT_ASSET_BYTES = {};'));
  assembled = assembled.replace('const BOOT_ASSET_BYTES = {};', `const BOOT_ASSET_BYTES = ${JSON.stringify(sizes)};`);
  // The already-disabled Yandex-only loader must never point at the host's /sdk.js.
  const yandexLoader = /load:\(\)=>new Promise\(\(resolve,reject\)=>\{\n[\s\S]*?script\.src='\/sdk\.js';[\s\S]*?\n  \}\),/;
  assert(yandexLoader.test(assembled), 'Review changed Yandex web adapter.');
  assembled = assembled.replace(yandexLoader, "load:()=>Promise.reject(new Error('Yandex SDK is unavailable in this web build')),");
  const start = assembled.indexOf('<script>\n(function(){');
  const end = assembled.indexOf('})();\n</script>', start);
  assert(start >= 0 && end > start, 'Main game script boundaries changed.');
  const codeStart = start + '<script>\n'.length, codeEnd = end + '})();'.length;
  const game = await minify(assembled.slice(codeStart, codeEnd), {
    compress: { passes: 2 }, mangle: true, format: { comments: false }
  });
  let html = localHtml(assembled.slice(0, codeStart) + game.code + assembled.slice(codeEnd));
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n' + languageBootstrap)
    .replace('</head>', '<link rel="stylesheet" href="potenceval.css">\n</head>')
    .replace('</body>', '<a id="potencevalHome" href="../" aria-label="potenceval — Home">← potenceval</a>\n</body>');
  assertPublicText(html, 'index.html');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.webmanifest'), 'utf8'));
  Object.assign(manifest, { id: './', start_url: './', scope: './' });
  const pages = Object.fromEntries(['about.html', 'privacy.html', 'terms.html'].map(name => {
    const text = localHtml(fs.readFileSync(path.join(source, name), 'utf8'));
    assertPublicText(text, name);
    return [name, text];
  }));

  // Only this fixed, non-symlink destination may be replaced on subsequent imports.
  if (fs.existsSync(destination)) {
    assert(!fs.lstatSync(destination).isSymbolicLink(), 'Refusing linked aura directory.');
    assert.equal(fs.realpathSync(destination), path.join(fs.realpathSync(workspace), 'aura'));
    assert(fs.existsSync(path.join(destination, 'potenceval.css')), 'Refusing an unrecognized aura directory.');
    fs.rmSync(destination, { recursive: true });
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const relative of files) {
    const target = path.join(destination, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(source, relative), target);
  }
  fs.writeFileSync(path.join(destination, 'assets/menu/parallax-v1/scene.js'), hall.code);
  fs.writeFileSync(path.join(destination, 'index.html'), html);
  fs.writeFileSync(path.join(destination, 'potenceval.css'), homeStyle);
  fs.writeFileSync(path.join(destination, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
  for (const [name, text] of Object.entries(pages)) fs.writeFileSync(path.join(destination, name), text);
  // Hosting configuration, service workers, source, tools, and debug pages are not imported.
  await checkRelease();
}

(process.argv.includes('--check') ? checkRelease() : build()).catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
