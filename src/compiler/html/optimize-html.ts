import * as d from '../../declarations';
import { assetVersioning } from './asset-versioning';
import { collapseHtmlWhitepace } from './collapse-html-whitespace';
import { inlineComponentStyles } from '../style/inline-styles';
import { inlineExternalAssets } from './inline-external-assets';
import { inlineLoaderScript } from './inline-loader-script';
import { insertCanonicalLink } from './canonical-link';
import { minifyInlineScripts } from './minify-inline-scripts';
import { minifyInlineStyles } from '../style/minify-inline-styles';


export async function optimizeHtml(config: d.Config, compilerCtx: d.CompilerCtx, outputTarget: d.OutputTargetHydrate, doc: Document, styles: string[], results: d.HydrateResults) {
  const promises: Promise<any>[] = [];

  if (outputTarget.hydrateComponents !== false) {
    doc.documentElement.setAttribute('data-ssr', '');
  }

  if (outputTarget.canonicalLink !== false) {
    try {
      insertCanonicalLink(config, doc, results);

    } catch (e) {
      results.diagnostics.push({
        level: 'error',
        type: 'hydrate',
        header: 'Insert Canonical Link',
        messageText: e
      });
    }
  }

  if (outputTarget.inlineStyles) {
    try {
      inlineComponentStyles(config, outputTarget, doc, styles, results.diagnostics);

    } catch (e) {
      results.diagnostics.push({
        level: 'error',
        type: 'hydrate',
        header: 'Inline Component Styles',
        messageText: e
      });
    }
  }

  if (outputTarget.inlineLoaderScript) {
    // remove the script to the external loader script request
    // inline the loader script at the bottom of the html
    promises.push(inlineLoaderScript(config, compilerCtx, outputTarget, doc, results));
  }

  if (outputTarget.inlineAssetsMaxSize > 0) {
    promises.push(inlineExternalAssets(config, compilerCtx, outputTarget, results, doc));
  }

  if (outputTarget.collapseWhitespace && !config.devMode && config.logLevel !== 'debug') {
    // collapseWhitespace is the default
    try {
      config.logger.debug(`optimize ${results.pathname}, collapse html whitespace`);
      collapseHtmlWhitepace(doc.documentElement);

    } catch (e) {
      results.diagnostics.push({
        level: 'error',
        type: 'hydrate',
        header: 'Reduce HTML Whitespace',
        messageText: e
      });
    }
  }

  // need to wait on to see if external files are inlined
  await Promise.all(promises);

  // reset for new promises
  promises.length = 0;

  if (config.minifyCss) {
    promises.push(minifyInlineStyles(config, compilerCtx, doc, results));
  }

  if (config.minifyJs) {
    promises.push(minifyInlineScripts(config, compilerCtx, doc, results));
  }

  if (config.assetVersioning) {
    promises.push(assetVersioning(config, compilerCtx, outputTarget, results.url, doc));
  }

  await Promise.all(promises);
}
