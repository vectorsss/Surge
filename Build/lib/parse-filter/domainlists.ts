import picocolors from 'picocolors';
import { fastNormalizeDomain } from '../normalize-domain';
import { processLine } from '../process-line';
import { onBlackFound } from './shared';
import { fetchAssets } from '../fetch-assets';
import type { Span } from '../../trace';

function domainListLineCb(l: string, set: string[], includeAllSubDomain: boolean, meta: string) {
  const line = processLine(l);
  if (!line) return;

  const domain = fastNormalizeDomain(line);
  if (!domain) return;
  if (domain !== line) {
    console.log(
      picocolors.red('[process domain list]'),
      picocolors.gray(`line: ${line}`),
      picocolors.gray(`domain: ${domain}`),
      picocolors.gray(meta)
    );

    return;
  }

  onBlackFound(domain, meta);

  set.push(includeAllSubDomain ? `.${line}` : line);
}

export function processDomainLists(
  span: Span,
  domainListsUrl: string, mirrors: string[] | null, includeAllSubDomain = false
) {
  return span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (span) => {
    const text = await span.traceChildAsync('download', () => fetchAssets(
      domainListsUrl,
      mirrors
    ));
    const domainSets: string[] = [];
    const filterRules = text.split('\n');

    span.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        domainListLineCb(filterRules[i], domainSets, includeAllSubDomain, domainListsUrl);
      }
    });

    return domainSets;
  });
}

export function processDomainListsWithPreload(domainListsUrl: string, mirrors: string[] | null, includeAllSubDomain = false) {
  const downloadPromise = fetchAssets(domainListsUrl, mirrors);

  return (span: Span) => span.traceChildAsync(`process domainlist: ${domainListsUrl}`, async (span) => {
    const text = await span.traceChildPromise('download', downloadPromise);
    const domainSets: string[] = [];
    const filterRules = text.split('\n');

    span.traceChildSync('parse domain list', () => {
      for (let i = 0, len = filterRules.length; i < len; i++) {
        domainListLineCb(filterRules[i], domainSets, includeAllSubDomain, domainListsUrl);
      }
    });

    return domainSets;
  });
}
