import * as THREE from 'three';
import { loadYuanmingyuanOverview, OVERVIEW_MAXIMUM_PHYSICAL_PIXELS } from './asset-overview.js';

const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const message = error => error?.message ?? String(error);
const abortReason = signal => signal?.reason ?? new DOMException('Museum overview loading aborted', 'AbortError');

/** One building overview layer, with no factory or implicit visual approval.
 *
 * descriptors: [{ id: siteId, assetId?: archiveId, site: { position:[x,y,z],
 *   rotationY, scale, assetId? }, manifestURL, approvedOverviewSHA256 }].
 * The approval hash must come from the externally reviewed catalog. An archive
 * manifest's own native-review boolean never supplies this approval.
 *
 * Site transforms are parent transforms: archived internal transforms remain
 * intact. load() serializes whole archive decoders; cancel() stops pending work
 * while keeping completed owners. dispose() hides/releases immediately and its
 * promise also waits for any decoder that ignored cancellation to be released.
 * evaluate() must run before each render using the actual renderer and camera.
 * setFullSite() identifies a mounted full model, not a requested destination.
 * No full-model scheduling or relaxed quality threshold is performed here.
 */
export function createMuseumOverviewLayer({ root, descriptors, baseURL = globalThis.location?.href, fetchImpl = globalThis.fetch, loadOverview = loadYuanmingyuanOverview, configure, onChange = () => {}, signal } = {}) {
  if (!root?.isObject3D || !Array.isArray(descriptors) || typeof fetchImpl !== 'function' || typeof loadOverview !== 'function') throw new Error('Museum overview layer requires a scene root, descriptors, and archive loader');
  const base = new URL(baseURL);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Museum overviews require an HTTP exhibition base URL');
  const sameOrigin = (path, parent = base) => { const url = new URL(path, parent); if (url.origin !== base.origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('Museum overview files must share the exhibition origin'); return url.href; };
  const ids = new Set(), records = descriptors.map(input => {
    if (!input || typeof input.id !== 'string' || !input.id || ids.has(input.id)) throw new Error('Museum overview site IDs must be nonempty and unique'); ids.add(input.id);
    if (!digest(input.approvedOverviewSHA256)) throw new Error(`Native overview approval SHA256 is required for ${input.id}`);
    const position = input.site?.position, rotationY = input.site?.rotationY ?? 0, scale = input.site?.scale ?? 1, assetId = input.assetId ?? input.site?.assetId ?? input.id;
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(rotationY) || !Number.isFinite(scale) || scale === 0 || typeof assetId !== 'string' || !assetId || input.site.id && input.site.id !== input.id || typeof input.manifestURL !== 'string' || !input.manifestURL) throw new Error(`Invalid overview site placement or identity: ${input.id}`);
    return { id: input.id, assetId, site: { ...input.site, id: input.id, assetId, position: [...position], rotationY, scale }, manifestURL: sameOrigin(input.manifestURL), approvedOverviewSHA256: input.approvedOverviewSHA256, owner: null, ticket: null, loadState: 'idle', precision: 'unavailable', reason: 'overview-not-loaded', error: null, projection: null };
  });
  const group = new THREE.Group(); group.name = 'yuanmingyuan-museum-overviews'; group.userData.representation = 'reviewed-building-overviews';
  let disposed = false, request = null, queue = Promise.resolve(), fullSiteId = null, lastView = null, viewError = null;
  const disposalErrors = [];
  function snapshot() {
    const sites = records.map(record => ({ id: record.id, assetId: record.assetId, loadState: record.loadState, precision: record.id === fullSiteId && !disposed ? 'full' : record.precision, visible: !!record.owner?.wrapper.visible && !disposed, needsDetail: record.id !== fullSiteId && record.precision === 'needsDetail' && !disposed, reason: record.id === fullSiteId && !disposed ? 'full-model-mounted' : record.reason, error: record.error, projection: record.projection ? { ...record.projection } : null }));
    const loaded = records.filter(record => record.owner).length;
    const status = disposed ? 'disposed' : request ? 'loading' : records.some(record => record.loadState === 'failed') ? loaded ? 'partial' : 'failed' : loaded === records.length ? 'ready' : loaded ? 'partial' : records.some(record => record.loadState === 'cancelled') ? 'cancelled' : 'idle';
    return { status, fullSiteId, sites, loaded, visible: sites.filter(site => site.visible).length, needsDetail: sites.filter(site => site.needsDetail).map(site => site.id), unavailable: sites.filter(site => site.precision === 'unavailable').map(site => site.id), physicalView: lastView ? { ...lastView } : null, viewError, disposalErrors: [...disposalErrors] };
  }
  const notify = () => onChange(snapshot());
  const current = ticket => !disposed && request === ticket && !ticket.controller.signal.aborted;
  function release(owner, id) {
    if (!owner || owner.released) return; owner.released = true;
    for (const action of [() => { if (owner.wrapper) { owner.wrapper.visible = false; owner.wrapper.removeFromParent(); } }, () => owner.asset?.group?.removeFromParent(), () => owner.asset?.dispose?.()]) {
      try { action(); } catch (error) { disposalErrors.push({ id, error: message(error) }); }
    }
    owner.wrapper?.clear();
  }
  function hide(record, precision, reason, error = null) { if (record.owner) record.owner.wrapper.visible = false; record.precision = precision; record.reason = reason; record.error = error; record.projection = null; }
  function assignFull(id) {
    if (id !== null && (typeof id !== 'string' || !id)) throw new Error('Full site must be a site ID or null');
    if (fullSiteId === id) return false;
    const previous = fullSiteId; fullSiteId = id;
    for (const record of records) {
      if (record.id === id) hide(record, 'full', 'full-model-mounted', record.error);
      else if (record.id === previous) hide(record, record.loadState === 'failed' ? 'needsDetail' : 'unavailable', record.owner ? 'view-evaluation-required' : record.loadState === 'failed' ? 'overview-load-failed' : 'overview-not-loaded', record.error);
    }
    return true;
  }
  async function exhibitionFetch(url, options) {
    const response = await fetchImpl(sameOrigin(url), options);
    if (response.url) sameOrigin(response.url);
    return response;
  }
  async function readArchive(record, loadingSignal) {
    const response = await exhibitionFetch(record.manifestURL, { signal: loadingSignal });
    if (!response.ok) throw new Error(`Museum overview manifest HTTP ${response.status}`);
    const manifest = await response.json(); if (loadingSignal.aborted) throw abortReason(loadingSignal);
    if (manifest.kind !== 'yuanmingyuan-overview-archive' || manifest.id !== record.assetId || manifest.fullResolutionReplaced !== false || !digest(manifest.sourceArchiveDigest)) throw new Error(`Museum overview archive identity or representation mismatch: ${record.id}`);
    if (manifest.overview?.sha256 !== record.approvedOverviewSHA256) throw new Error(`Native overview approval does not match this report: ${record.id}`);
    const files = {};
    for (const key of ['glb', 'runtime', 'overview']) {
      const entry = manifest[key]; if (typeof entry?.url !== 'string' || !digest(entry.sha256) || !Number.isInteger(entry.bytes) || entry.bytes <= 0) throw new Error(`Invalid museum overview ${key} descriptor`);
      files[key] = { ...entry, url: sameOrigin(entry.url, record.manifestURL) };
    }
    return loadOverview({ ...manifest, ...files }, { signal: loadingSignal, fetchImpl: exhibitionFetch });
  }
  function cancelTicket(ticket) {
    if (!ticket) return;
    ticket.controller.abort();
    if (request !== ticket) return;
    request = null;
    for (const record of records) if (record.ticket === ticket && ['queued', 'loading'].includes(record.loadState)) { record.loadState = 'cancelled'; hide(record, 'unavailable', 'overview-loading-cancelled'); }
    notify();
  }
  function linkSignal(ticket, external) {
    if (!external || ticket.signals.has(external)) return;
    const abort = () => cancelTicket(ticket); ticket.signals.set(external, abort);
    if (external.aborted) abort(); else external.addEventListener('abort', abort, { once: true });
  }
  function load({ signal: loadingSignal } = {}) {
    if (disposed) return Promise.resolve(snapshot());
    if (loadingSignal?.aborted) return Promise.reject(abortReason(loadingSignal));
    if (request) { linkSignal(request, loadingSignal); return request.promise; }
    const pending = records.filter(record => record.loadState !== 'ready'); if (!pending.length) return Promise.resolve(snapshot());
    const ticket = { controller: new AbortController(), signals: new Map(), promise: null }; request = ticket;
    for (const record of pending) { record.ticket = ticket; record.loadState = 'queued'; hide(record, 'unavailable', 'overview-loading'); }
    ticket.promise = queue.catch(() => {}).then(async () => {
      try {
        for (const record of pending) {
          if (!current(ticket)) break;
          record.loadState = 'loading'; notify(); if (!current(ticket)) break;
          let owner = null;
          try {
            const asset = await readArchive(record, ticket.controller.signal); owner = { asset, wrapper: null, released: false };
            if (!asset?.group?.isObject3D || typeof asset.dispose !== 'function' || typeof asset.evaluate !== 'function') throw new Error('Museum overview loader did not return a scene and resource owner');
            if (!current(ticket)) { release(owner, record.id); continue; }
            await configure?.(asset, record.site); if (!current(ticket)) { release(owner, record.id); continue; }
            const wrapper = new THREE.Group(); owner.wrapper = wrapper; wrapper.name = `museum-overview-${record.id}`; wrapper.userData = { siteId: record.id, assetId: record.assetId, representation: 'reviewed-building-overview' };
            wrapper.position.fromArray(record.site.position); wrapper.rotation.y = record.site.rotationY; wrapper.scale.setScalar(record.site.scale); wrapper.visible = false; wrapper.add(asset.group);
            record.owner = owner; group.add(wrapper);
            if (!current(ticket)) { if (record.owner === owner) record.owner = null; release(owner, record.id); continue; }
            record.loadState = 'ready'; hide(record, record.id === fullSiteId ? 'full' : 'unavailable', record.id === fullSiteId ? 'full-model-mounted' : 'view-evaluation-required'); notify();
          } catch (error) {
            if (record.owner === owner) record.owner = null; release(owner, record.id);
            if (current(ticket)) { record.loadState = 'failed'; hide(record, 'needsDetail', 'overview-load-failed', message(error)); notify(); }
          }
        }
      } finally {
        for (const [external, abort] of ticket.signals) external.removeEventListener('abort', abort);
        if (request === ticket) { request = null; notify(); }
      }
      return snapshot();
    });
    queue = ticket.promise; linkSignal(ticket, loadingSignal); notify(); return ticket.promise;
  }
  function evaluate(input = {}) {
    if (disposed) return snapshot();
    if (Object.hasOwn(input, 'fullSiteId')) assignFull(input.fullSiteId);
    const { camera, renderer, pixelBudget = OVERVIEW_MAXIMUM_PHYSICAL_PIXELS } = input;
    let size;
    try {
      if (!camera?.isCamera || typeof renderer?.getDrawingBufferSize !== 'function' || !Number.isFinite(pixelBudget) || pixelBudget <= 0 || pixelBudget > OVERVIEW_MAXIMUM_PHYSICAL_PIXELS) throw new Error('A real camera, physical drawing buffer and at most 0.5-pixel budget are required');
      size = renderer.getDrawingBufferSize(new THREE.Vector2());
      if (!size || ![size.x, size.y].every(value => Number.isFinite(value) && value > 0)) throw new Error('Physical drawing buffer is unavailable');
      camera.updateWorldMatrix(true, false); lastView = { width: size.x, height: size.y, pixelBudget }; viewError = null;
    } catch (error) {
      viewError = message(error); lastView = null;
      for (const record of records) if (record.owner && record.id !== fullSiteId) hide(record, 'needsDetail', 'view-evaluation-failed', viewError);
      notify(); return snapshot();
    }
    for (const record of records) {
      if (!record.owner) continue;
      if (record.id === fullSiteId) { hide(record, 'full', 'full-model-mounted'); continue; }
      try {
        const result = record.owner.asset.evaluate({ camera, physicalWidth: size.x, physicalHeight: size.y, pixelBudget, approvedOverviewSHA256: record.approvedOverviewSHA256 });
        const eligible = result?.eligible === true && result.selection === 'overview' && Number.isFinite(result.projectedErrorPhysicalPixels) && result.projectedErrorPhysicalPixels >= 0 && result.projectedErrorPhysicalPixels <= pixelBudget && record.owner.asset.group.visible !== false;
        record.owner.wrapper.visible = eligible; record.precision = eligible ? 'overview' : 'needsDetail'; record.reason = eligible ? 'certified-overview-visible' : record.owner.asset.group.visible === false ? 'archive-root-hidden' : result?.reason ?? 'overview-quality-not-certified'; record.error = null; record.projection = { ...result };
      } catch (error) { hide(record, 'needsDetail', 'overview-evaluation-failed', message(error)); }
    }
    notify(); return snapshot();
  }
  function update(timeSeconds) {
    if (disposed || !Number.isFinite(timeSeconds)) return;
    for (const record of records) if (record.owner) {
      try { record.owner.asset.update?.(timeSeconds); }
      catch (error) { const owner = record.owner; record.owner = null; release(owner, record.id); record.loadState = 'failed'; hide(record, 'needsDetail', 'overview-animation-failed', message(error)); notify(); }
    }
  }
  function dispose() {
    if (!disposed) {
      disposed = true; request?.controller.abort(); request = null; signal?.removeEventListener('abort', dispose);
      for (const record of records) { release(record.owner, record.id); record.owner = null; record.loadState = 'disposed'; hide(record, 'unavailable', 'overview-layer-disposed'); }
      group.removeFromParent(); group.clear(); notify();
    }
    return queue.catch(() => {}).then(snapshot);
  }
  if (signal?.aborted) dispose(); else { root.add(group); signal?.addEventListener('abort', dispose, { once: true }); }
  return { group, load, evaluate, update, setFullSite(id) { if (!disposed && assignFull(id)) notify(); return snapshot(); }, cancel() { cancelTicket(request); return queue.catch(() => {}).then(snapshot); }, dispose, get snapshot() { return snapshot(); } };
}
