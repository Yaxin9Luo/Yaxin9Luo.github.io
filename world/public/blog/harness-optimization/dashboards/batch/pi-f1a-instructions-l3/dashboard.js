/* Study dashboard: renders window.STUDY_DASHBOARD (ExperimentDashboardV1, whose segments hold
   StudyDashboardV11 snapshots) with plain DOM and SVG. ?segment=<study id> picks the segment the
   sections below the experiment timeline show; the latest one by default.
   Every string from the snapshot is inserted as text, never as markup. */
"use strict";

(() => {
  const experiment = window.STUDY_DASHBOARD;
  const segments = experiment && Array.isArray(experiment.segments) ? experiment.segments : [];
  const requested = new URLSearchParams(window.location.search).get("segment");
  const chosen = segments.find((item) => item.snapshot.study.study_id === requested) || segments[segments.length - 1];
  const data = chosen ? chosen.snapshot : null;
  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---------------------------------------------------------------- utilities

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    applyAttrs(node, attrs);
    appendChildren(node, children);
    return node;
  }

  function svg(tag, attrs, ...children) {
    const node = document.createElementNS(SVG_NS, tag);
    applyAttrs(node, attrs);
    appendChildren(node, children);
    return node;
  }

  function applyAttrs(node, attrs) {
    if (!attrs) return;
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "text") node.textContent = String(value);
      else if (key === "on") {
        for (const [event, handler] of Object.entries(value)) node.addEventListener(event, handler);
      } else if (key === "dataset") {
        for (const [name, item] of Object.entries(value)) node.dataset[name] = String(item);
      } else node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  function appendChildren(node, children) {
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
    }
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  const byId = (id) => document.getElementById(id);

  const store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem("rsi-study-dashboard:" + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (error) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem("rsi-study-dashboard:" + key, JSON.stringify(value));
      } catch (error) {
        /* storage is a convenience only */
      }
    },
  };

  const MINUS = "−";
  const DASH = "–";

  function numeric(value) {
    if (value === true) return 1;
    if (value === false) return 0;
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function mean(values) {
    const known = values.filter((value) => value !== null && value !== undefined);
    return known.length ? known.reduce((sum, value) => sum + value, 0) / known.length : null;
  }

  function median(values) {
    const sorted = values.filter((value) => value !== null && value !== undefined).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function sum(values) {
    const known = values.filter((value) => value !== null && value !== undefined);
    return known.length ? known.reduce((total, value) => total + value, 0) : null;
  }

  function fmt(value, digits = 3) {
    if (value === null || value === undefined) return DASH;
    if (typeof value === "boolean") return value ? "pass" : "fail";
    return Number(value).toFixed(digits);
  }

  function fmtSigned(value, digits = 3) {
    if (value === null || value === undefined) return DASH;
    const text = Math.abs(value).toFixed(digits);
    if (Number(text) === 0) return "±" + text;
    return (value > 0 ? "+" : MINUS) + text;
  }

  function fmtCompact(value) {
    if (value === null || value === undefined) return DASH;
    const magnitude = Math.abs(value);
    if (magnitude >= 1e9) return (value / 1e9).toFixed(2) + "B";
    if (magnitude >= 1e6) return (value / 1e6).toFixed(2) + "M";
    if (magnitude >= 1e4) return (value / 1e3).toFixed(1) + "k";
    return Math.round(value).toLocaleString("en-US");
  }

  function fmtDuration(seconds) {
    if (seconds === null || seconds === undefined) return DASH;
    if (seconds < 90) return seconds.toFixed(seconds < 10 ? 1 : 0) + " s";
    const minutes = seconds / 60;
    if (minutes < 90) return minutes.toFixed(minutes < 10 ? 1 : 0) + " min";
    const hours = Math.floor(minutes / 60);
    return hours + " h " + Math.round(minutes - hours * 60) + " min";
  }

  function costUnit(key) {
    if (key.endsWith("_usd")) return { label: key.slice(0, -4), prefix: "$" };
    if (key.endsWith("_yuan")) return { label: key.slice(0, -5), prefix: "¥" };
    return { label: key, prefix: "" };
  }

  function fmtCost(key, value) {
    if (value === null || value === undefined) return DASH;
    return costUnit(key).prefix + value.toFixed(2);
  }

  function shortId(value) {
    return value ? value.slice(0, 12) : DASH;
  }

  function truncate(text, limit) {
    if (!text) return "";
    return text.length > limit ? text.slice(0, limit - 1) + "…" : text;
  }

  // ---------------------------------------------------------------- snapshot model

  if ((!experiment || experiment.format_version !== 1) || !data || data.format_version !== 11) {
    document.body.textContent = "";
    document.body.appendChild(
      el("p", {
        class: "empty-state",
        text: "snapshot.js is missing or not a format 1 experiment dashboard of format 2 Study snapshots.",
      })
    );
    return;
  }

  const study = data.study;
  const metricTypes = new Map(study.metrics.map((item) => [item.name, item.value_type]));
  const rule = study.dev_rule;
  const REASONS = { cleared: "cleared its bar", below_bar: "below the bar", over_time_cap: "over the time cap", more_failures: "more Agent failures", more_flagged_runs: "more flagged runs" };

  // A V7 rule, or a decision under one, keeps on the logit scale less a priced cost term and a
  // priced flagged-run term.
  const isLogit = (item) => !!item && item.format_version === 7;
  // The bar a rule or decision compares with: V7's logit bar, V5's score threshold.
  const barOf = (item) => (isLogit(item) ? item.logit_bar : item.min_mean_difference);

  // The rule in words: the score bar, the price of each slower median minute (V5) or of the cost
  // ratio (V7), and the time cap.
  function ruleText(item) {
    let text;
    if (isLogit(item)) {
      text = "keep when logit(mean " + item.metric + ") − logit(parent's)";
      if (item.cost_weight) text += " − " + fmt(item.cost_weight, 4) + " × ln(cost ratio)";
      text += " ≥ " + fmt(item.logit_bar, 4) + " (calibrated at p0 " + item.p0 + ", z " + item.z + ", σ0 " + item.sigma0 + ", " + item.n_pairs + " pairs)";
      if (item.cost_weight) {
        const prices = item.prices;
        text += "; cost per 1M tokens " + prices.uncached_input + " uncached input, " + prices.cache_write + " cache write, " + prices.cache_read + " cache read, " + prices.output + " output " + item.currency;
      }
    } else {
      text = "keep when mean " + item.metric + " difference";
      if (item.wall_time_price_per_minute) text += " − " + item.wall_time_price_per_minute + " × Δ median minutes";
      text += " ≥ " + item.min_mean_difference;
    }
    if (item.max_median_wall_minutes !== null) text += " and median run ≤ " + item.max_median_wall_minutes + " min";
    if (item.metric_bounds) text += "; a missing run is bounded by " + item.metric_bounds[0] + "–" + item.metric_bounds[1];
    if (item.agent_failures === "excluded") {
      text += "; a pair with an Agent failure is left out";
      if (item.max_failure_increase !== null) text += ", and more than " + item.max_failure_increase + " failure" + (item.max_failure_increase === 1 ? "" : "s") + " beyond the parent's reverts";
    }
    if (item.clean_run_metric !== null && isLogit(item)) text += "; a run with " + item.clean_run_metric + " false is flagged, and each flagged run beyond the parent's costs " + item.flag_weight + " × " + fmt(item.logit_bar, 4) + ", each one fewer gains as much";
    else if (item.clean_run_metric !== null) text += "; a run with " + item.clean_run_metric + " false is flagged, and more than " + item.max_flag_increase + " flagged run" + (item.max_flag_increase === 1 ? "" : "s") + " beyond the parent's reverts";
    return text;
  }

  // The decision's side counts: Agent failures with the pairs they left out, and with a clean-run
  // metric the flagged runs (counted on the pairs the comparison used).
  function failuresText(decision) {
    return decision.excluded_pairs || decision.candidate_failures || decision.parent_failures
      ? "; Agent failures " + decision.candidate_failures + " vs parent " + decision.parent_failures + ", " + decision.excluded_pairs + " pair" + (decision.excluded_pairs === 1 ? "" : "s") + " left out"
      : "";
  }

  function flaggedText(decision) {
    return rule && rule.clean_run_metric !== null
      ? "; flagged runs (" + rule.clean_run_metric + " false) " + decision.candidate_flagged + " vs parent " + decision.parent_flagged
      : "";
  }

  // What the rule compared: the time-adjusted difference against the bar, and why it decided.
  function decisionText(decision) {
    const priced = decision.wall_time_price_per_minute > 0;
    const pairedText = decision.mean_difference !== null ? "; paired " + decision.metric + " difference over the compared pairs " + fmtSigned(decision.mean_difference) : "";
    if (decision.reason === "more_flagged_runs") {
      return (
        decision.verdict + " (" + REASONS[decision.reason] + "): flagged runs " + decision.candidate_flagged +
        " vs parent " + decision.parent_flagged + ", more than the rule allows" + failuresText(decision) + pairedText
      );
    }
    if (decision.reason === "more_failures") {
      return (
        decision.verdict + " (" + REASONS[decision.reason] + "): Agent failures " + decision.candidate_failures +
        " vs parent " + decision.parent_failures + ", more than the rule allows; " + decision.excluded_pairs +
        " pair" + (decision.excluded_pairs === 1 ? "" : "s") + " left out" + pairedText
      );
    }
    // With a clean-run metric a run can miss only its flag value; it goes to the bounds as well.
    const missing = rule && rule.clean_run_metric !== null ? "without a value or a flag value" : "without a value";
    if (isLogit(decision)) return logitText(decision, missing);
    return (
      decision.verdict + " (" + REASONS[decision.reason] + "): " +
      (priced ? "adjusted " + fmtSigned(decision.adjusted_difference) + " = " : "") +
      "paired " + decision.metric + " difference " + fmtSigned(decision.mean_difference) +
      (priced ? " − " + decision.wall_time_price_per_minute + " × " + fmtSigned(decision.candidate_median_wall_minutes - decision.parent_median_wall_minutes, 1) + " min" : "") +
      " vs bar " + fmtSigned(decision.min_mean_difference) +
      "; median run " + fmt(decision.candidate_median_wall_minutes, 1) + " min vs parent " + fmt(decision.parent_median_wall_minutes, 1) + " min" +
      (decision.max_median_wall_minutes !== null ? " (cap " + decision.max_median_wall_minutes + " min)" : "") +
      (decision.decided_by === "bounds"
        ? "; " + decision.missing_runs + " run" + (decision.missing_runs === 1 ? "" : "s") + " " + missing + ", decided because the best and the worst case for " + (decision.missing_runs === 1 ? "it" : "them") + " give the same verdict (difference over complete pairs)"
        : "") +
      failuresText(decision) +
      flaggedText(decision)
    );
  }

  // A V6 decision's comparison, every value as its record holds it: the logit difference of the
  // sides' means less the cost term (a ratio of the sides' total costs) against the logit bar.
  function logitText(decision, missing) {
    const money = (value) => (value === null ? DASH : fmt(value, 2) + " " + decision.currency);
    const cost =
      decision.cost_basis === "unavailable"
        ? "; cost left out: no compared run could be priced (" + decision.unpriced_reasons.join(", ") + ")"
        : decision.cost_basis === "unweighted"
          ? ""
          : " − cost term " + fmtSigned(decision.cost_term) + " (" + fmt(decision.cost_weight, 4) + " × ln(" + money(decision.candidate_cost_yuan) + " over " + decision.candidate_cost_runs + " runs / " + money(decision.parent_cost_yuan) + " over " + decision.parent_cost_runs + "))";
    const flags =
      decision.flag_weight === null
        ? ""
        : " − flag term " + (decision.flag_term === null ? DASH : fmtSigned(decision.flag_term)) + " (" + decision.flag_weight + " × " + fmt(decision.logit_bar, 4) + " × (" + decision.candidate_flagged + " − " + decision.parent_flagged + ") flagged runs)";
    const unpriced =
      decision.cost_basis === "priced" && decision.unpriced_runs
        ? "; " + decision.unpriced_runs + " run" + (decision.unpriced_runs === 1 ? "" : "s") + " not priced (" + decision.unpriced_reasons.join(", ") + ")"
        : "";
    return (
      decision.verdict + " (" + REASONS[decision.reason] + "): adjusted " + fmtSigned(decision.adjusted_difference) +
      " = logit difference " + fmtSigned(decision.logit_difference) + " (mean " + fmt(decision.candidate_mean) + " vs parent " + fmt(decision.parent_mean) + ")" +
      cost + flags + " vs bar " + fmtSigned(decision.logit_bar, 4) + " (" + fmtSigned(decision.bar_raw) + " raw at the parent's mean)" +
      "; median run " + fmt(decision.candidate_median_wall_minutes, 1) + " min vs parent " + fmt(decision.parent_median_wall_minutes, 1) + " min" +
      (decision.max_median_wall_minutes !== null ? " (cap " + decision.max_median_wall_minutes + " min)" : "") +
      (decision.decided_by === "bounds"
        ? "; " + decision.missing_runs + " run" + (decision.missing_runs === 1 ? "" : "s") + " " + missing + " or a cost, decided because the best and the worst case give the same verdict (values over the runs it had)"
        : "") +
      unpriced +
      failuresText(decision) +
      flaggedText(decision)
    );
  }

  // What a released search run's detail release showed the Meta Agent. A grader's failed-item
  // feedback (result.feedback) is listed item by item; other released details show as JSON.
  function releasedSummary(run) {
    const details = run.released_details;
    if (!details) return { text: "", title: "" };
    const feedback = details.result && details.result.feedback;
    if (feedback && (feedback.conditions_failed || feedback.design_failed)) {
      const conditions = feedback.conditions_failed || [];
      const design = feedback.design_failed || [];
      const lines = [
        ...conditions.map((item) => "requirement " + (item && item.requirement_index !== undefined ? item.requirement_index : "?") + ": " + ((item && item.text) || "")),
        ...design.map((item) => "design " + ((item && item.axis) || "") + " " + ((item && item.item) || "") + ": " + ((item && item.text) || "")),
      ];
      return {
        text: " · " + conditions.length + " failed condition" + (conditions.length === 1 ? "" : "s") + ", " + design.length + " failed design item" + (design.length === 1 ? "" : "s"),
        title: lines.length ? "Shown to the Meta Agent:\n" + lines.join("\n") : "Shown to the Meta Agent: nothing failed",
      };
    }
    return { text: " · details", title: "Shown to the Meta Agent:\n" + JSON.stringify(details, null, 1).slice(0, 4000) };
  }

  // A run's state with what ended it: the backend's error status and any earlier attempts the
  // batch ran again for an infrastructure reason.
  function runState(run) {
    let text = run.classification || run.attempt_status || run.job_state;
    if (run.backend_error_status !== null && run.classification) text += " · backend " + run.backend_error_status;
    if (run.earlier_attempts.length) {
      text += " · rerun after " + run.earlier_attempts.map((item) => (item.classification || item.status) + (item.backend_error_status !== null ? " " + item.backend_error_status : "") + (item.last_stop_reason ? " (stopped: " + item.last_stop_reason + ")" : "")).join(", ");
    }
    return text;
  }

  // The value the rule compared with its bar: the time-adjusted difference when time has a price.
  function decisionValue(decision) {
    if (isLogit(decision)) return decision.adjusted_difference;
    return decision.wall_time_price_per_minute > 0 ? decision.adjusted_difference : decision.mean_difference;
  }

  // The keep bar in score units: the parent's dev mean plus the threshold plus the price of the
  // slower median, from the decision when there is one and from the runs while it is pending.
  function keepBar(point) {
    if (isLogit(rule)) {
      // The recorded raw bar at the parent's mean; a pending candidate has none yet, and the
      // cost term is not drawn.
      const decision = point.item.decision;
      return decision && isLogit(decision) && decision.bar_raw !== null ? decision.parent_mean + decision.bar_raw : null;
    }
    let slower = 0;
    if (rule.wall_time_price_per_minute) {
      const decision = point.item.decision;
      if (decision) slower = decision.candidate_median_wall_minutes - decision.parent_median_wall_minutes;
      else {
        const own = medianMinutes(point.item.revision_id, "dev").minutes;
        const parent = point.parent ? medianMinutes(point.parent.item.revision_id, "dev").minutes : null;
        slower = own !== null && parent !== null ? own - parent : 0;
      }
    }
    return point.parent.mean + rule.min_mean_difference + rule.wall_time_price_per_minute * slower;
  }
  const revisions = data.revisions.slice();
  const baseline = revisions.find((item) => item.role === "baseline");
  const official = revisions.find((item) => item.role === "official_baseline");
  const candidates = revisions
    .filter((item) => item.role === "candidate")
    .sort((left, right) => left.order - right.order);
  const byRevisionId = new Map();
  for (const item of revisions) if (!byRevisionId.has(item.revision_id)) byRevisionId.set(item.revision_id, item);
  const iterations = data.iterations.slice().sort((left, right) => left.number - right.number);
  const iterationByCandidate = new Map(
    iterations.filter((item) => item.candidate_id).map((item) => [item.candidate_id, item])
  );
  const runs = data.runs;
  const STAGE_ORDER = ["search", "dev", "final"];
  // Stages and the default stage come from the whole experiment, so switching the selected Study
  // keeps the stage the reader chose instead of jumping to whatever that Study has run so far.
  const allRuns = segments.flatMap((segment) => segment.snapshot.runs);
  const stages = STAGE_ORDER.filter((stage) => allRuns.some((run) => run.stage === stage));
  if (!stages.length) {
    for (const stage of STAGE_ORDER) if (data.tasks.some((task) => task.stage === stage)) stages.push(stage);
  }
  const anyRule = segments.some((segment) => segment.snapshot.study.dev_rule !== null);
  const costKeys = [...new Set(iterations.flatMap((item) => Object.keys(item.costs)))].sort();

  const OUTCOMES = {
    baseline: { label: "baseline", icon: "B" },
    keep: { label: "kept", icon: "✓" },
    revert: { label: "reverted", icon: "↩" },
    undecided: { label: "undecided", icon: "?" },
    abandoned: { label: "abandoned", icon: "–" },
    rejected: { label: "rejected", icon: "✕" },
    pending: { label: "pending", icon: "…" },
    no_submission: { label: "no submission", icon: "∅" },
    running: { label: "running", icon: "…" },
  };

  function outcomeBadge(outcome) {
    const known = OUTCOMES[outcome] || { label: outcome || "unknown", icon: "?" };
    return el(
      "span",
      { class: "outcome" },
      el("span", { class: "status-icon " + outcome, "aria-hidden": "true", text: known.icon }),
      known.label
    );
  }

  function assignedNote(run, metric) {
    // A frozen policy value stands in for an evaluator rejection or the Agent's own failure.
    if (!run.policy_assigned.includes(metric)) return "";
    return " (policy value: " + (run.classification || run.evaluation_failure_code || "assigned") + ")";
  }

  function revisionLabel(revisionId) {
    const item = byRevisionId.get(revisionId);
    return item ? item.label : shortId(revisionId);
  }

  // ---------------------------------------------------------------- filters

  // Filters are remembered per Study: Studies differ in metrics and in the metric their rule
  // compares, so one Study's choice must not hide another's default.
  const filterKey = (name) => "filter:" + study.study_id + ":" + name;
  const state = {
    stage: store.get(filterKey("stage"), null),
    metric: store.get(filterKey("metric"), null),
    backend: store.get(filterKey("backend"), "all"),
    heat: store.get("heat", null),
    tables: {},
  };
  if (!stages.includes(state.stage)) {
    state.stage = anyRule && stages.includes("dev") ? "dev" : stages[0] || "search";
  }
  if (!metricTypes.has(state.metric)) {
    const firstNumber = study.metrics.find((item) => item.value_type === "number");
    state.metric = rule ? rule.metric : (firstNumber || study.metrics[0] || {}).name;
  }
  if (state.backend !== "all" && !study.backends.some((item) => item.backend_id === state.backend)) {
    state.backend = "all";
  }
  if (!Array.isArray(state.heat) || !state.heat.every((name) => metricTypes.has(name))) {
    state.heat = [state.metric];
  }

  function runsFor(revisionId, stage) {
    return runs.filter(
      (run) =>
        run.revision_id === revisionId &&
        run.stage === stage &&
        (state.backend === "all" || run.backend_id === state.backend)
    );
  }

  // A dev rule that leaves Agent failures out never compares them, so a dev mean leaves them out too and
  // counts them as unscored, as the exported scores do; search runs are what the Meta Agent saw.
  const failuresOut = Boolean(rule && rule.agent_failures === "excluded");

  function stageMean(revisionId, stage, metric) {
    const own = runsFor(revisionId, stage);
    const values = own.map((run) =>
      failuresOut && stage === "dev" && run.agent_failure ? null : numeric(run.metrics[metric])
    );
    return {
      mean: mean(values),
      scored: values.filter((value) => value !== null).length,
      runs: own.length,
    };
  }

  // Every run with a recorded duration counts, as in the Study's dev rule.
  function medianMinutes(revisionId, stage) {
    const timed = runsFor(revisionId, stage).filter((run) => run.duration_seconds !== null);
    const value = median(timed.map((run) => run.duration_seconds / 60));
    return { minutes: value, timed: timed.length };
  }

  function columnsFor(stage) {
    const columns = [baseline];
    if (official) columns.push(official);
    for (const item of candidates) if (item.status === "admitted") columns.push(item);
    return columns.filter((item) => item && runsFor(item.revision_id, stage).length);
  }

  function setupFilters() {
    const stageSelect = byId("filter-stage");
    for (const stage of stages) stageSelect.appendChild(el("option", { value: stage, text: stage }));
    stageSelect.value = state.stage;
    const metricSelect = byId("filter-metric");
    for (const item of study.metrics) {
      metricSelect.appendChild(
        el("option", {
          value: item.name,
          text: (item.value_type === "boolean" ? item.name + " (pass rate)" : item.name) + (rule && rule.metric === item.name ? " · dev rule" : ""),
        })
      );
    }
    metricSelect.value = state.metric;
    const backendSelect = byId("filter-backend");
    backendSelect.appendChild(el("option", { value: "all", text: "all backends" }));
    for (const item of study.backends) {
      backendSelect.appendChild(el("option", { value: item.backend_id, text: item.backend_id }));
    }
    backendSelect.value = state.backend;
    const update = () => {
      state.stage = stageSelect.value;
      state.metric = metricSelect.value;
      state.backend = backendSelect.value;
      store.set(filterKey("stage"), state.stage);
      store.set(filterKey("metric"), state.metric);
      store.set(filterKey("backend"), state.backend);
      renderAll();
    };
    for (const select of [stageSelect, metricSelect, backendSelect]) select.addEventListener("change", update);
    byId("filters").addEventListener("submit", (event) => event.preventDefault());
    byId("filters-note").textContent =
      "Means are over scored runs; a boolean metric shows its pass rate." +
      (rule ? " The dev rule compares " + rule.metric + (rule.clean_run_metric !== null ? " and counts runs with " + rule.clean_run_metric + " false" : "") + "." : "");
  }

  // ---------------------------------------------------------------- tooltip

  const tooltip = byId("tooltip");

  function showTooltip(anchor, nodes) {
    clear(tooltip);
    appendChildren(tooltip, nodes);
    tooltip.hidden = false;
    let x;
    let y;
    if (anchor && "clientX" in anchor && anchor.clientX) {
      x = anchor.clientX + 14;
      y = anchor.clientY + 14;
    } else {
      const target = anchor && anchor.currentTarget ? anchor.currentTarget : anchor;
      const box = target.getBoundingClientRect();
      x = box.right + 8;
      y = box.top;
    }
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    if (x + width > window.innerWidth - 8) x = Math.max(8, x - width - 28);
    if (y + height > window.innerHeight - 8) y = Math.max(8, window.innerHeight - height - 8);
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function hoverable(node, content) {
    const show = (event) => showTooltip(event, content());
    node.addEventListener("pointermove", show);
    node.addEventListener("focus", show);
    node.addEventListener("pointerleave", hideTooltip);
    node.addEventListener("blur", hideTooltip);
  }

  function tipValue(text) {
    return el("div", { class: "tt-value", text });
  }

  function tipLabel(text) {
    return el("div", { class: "tt-label", text });
  }

  function tipText(text) {
    return el("div", { class: "tt-text", text });
  }

  // ---------------------------------------------------------------- chart helpers

  function niceTicks(low, high, count = 5) {
    if (low === high) {
      low -= 0.5;
      high += 0.5;
    }
    const span = high - low;
    const raw = span / count;
    const power = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((item) => item * power).find((item) => item >= raw) || raw;
    const start = Math.floor(low / step) * step;
    const end = Math.ceil(high / step) * step;
    const ticks = [];
    for (let value = start; value <= end + step / 2; value += step) ticks.push(Number(value.toFixed(10)));
    return { low: start, high: end, ticks, step };
  }

  function thinLabels(positions, minimum) {
    // Keep labels at least ``minimum`` pixels apart; the last one always shows.
    const shown = [];
    positions.forEach((x, index) => {
      if (!shown.length || x - positions[shown[shown.length - 1]] >= minimum) shown.push(index);
    });
    const last = positions.length - 1;
    if (last >= 0 && shown[shown.length - 1] !== last) {
      while (shown.length && positions[last] - positions[shown[shown.length - 1]] < minimum) shown.pop();
      shown.push(last);
    }
    return new Set(shown);
  }

  function chartCard(container, title, subtitle, drawChart, drawTable) {
    clear(container);
    const key = container.id;
    const showTable = Boolean(state.tables[key]);
    const toggle = el("button", {
      type: "button",
      class: "ghost",
      text: showTable ? "Chart" : "Table",
      "aria-pressed": showTable ? "true" : "false",
      on: {
        click: () => {
          state.tables[key] = !state.tables[key];
          chartCard(container, title, subtitle, drawChart, drawTable);
        },
      },
    });
    container.appendChild(
      el("div", { class: "card-head" }, el("h3", { text: title }), subtitle ? el("span", { class: "subtle", text: subtitle }) : null, toggle)
    );
    const body = el("div", { class: showTable ? "scroll-x" : "chart-wrap" });
    container.appendChild(body);
    if (showTable) drawTable(body);
    else drawChart(body);
  }

  function legend(items) {
    return el(
      "div",
      { class: "legend" },
      items.map((item) => el("span", { class: "legend-item" }, item.key, item.label))
    );
  }

  function lineKey(cls) {
    return el("span", { class: "key-line " + cls, "aria-hidden": "true" });
  }

  function boxKey(cls) {
    return el("span", { class: "key-box " + cls, "aria-hidden": "true" });
  }

  function table(headers, rows, options = {}) {
    const head = el(
      "tr",
      null,
      headers.map((header, index) => {
        const cell = el("th", {
          scope: "col",
          class: [header.num ? "num" : "", options.sortable ? "sortable" : ""].join(" ").trim() || null,
          text: header.label,
          title: header.title || null,
        });
        if (options.sortable) {
          cell.addEventListener("click", () => options.onSort(index));
          if (options.sort && options.sort.index === index) {
            cell.textContent = header.label + (options.sort.descending ? " ↓" : " ↑");
            cell.setAttribute("aria-sort", options.sort.descending ? "descending" : "ascending");
          }
        }
        return cell;
      })
    );
    return el("table", null, el("thead", null, head), el("tbody", null, rows));
  }

  // ---------------------------------------------------------------- header, warnings, tiles

  const SCOPES = { instructions: "L1", tools: "L2", loop: "L3" };

  function renderHeader() {
    document.title = study.study_id + " · Study dashboard";
    byId("study-title").textContent =
      (segments.length > 1 ? experiment.experiment_id + " · " : "") + "Study " + study.study_id;
    byId("study-state").textContent = study.state.replace(/_/g, " ");
    const condition = clear(byId("study-condition"));
    if (study.condition) {
      const c = study.condition;
      const chip = (text, title) => el("span", { class: "change-chip changed", text, title });
      condition.append(
        chip("feedback " + c.arm, "The Meta Agent's feedback arm"),
        chip("edit scope " + SCOPES[c.scope] + " · " + c.scope, "The Pi Harness scope the Meta Agent may edit"),
        chip("lineage " + c.lineage, "Which of the condition's independent lineages this Study is"),
        chip("trace release " + study.trace_release, "What trace detail the Meta Agent can read"),
        chip("Meta Agent " + c.meta_model + " · " + c.meta_effort, "The Meta Agent's model and reasoning effort")
      );
    }
    const parts = [
      runs.length + " runs",
      candidates.length + " candidates",
      study.operations + " ledger operations",
      "backends " + study.backends.map((item) => item.backend_id + " (" + item.model + ")").join(", "),
      study.repeats + (study.repeats === 1 ? " repeat" : " repeats"),
    ];
    if (rule) parts.push("dev rule: " + ruleText(rule) + " (frozen in the " + rule.frozen_in + ")");
    parts.push("snapshot " + data.generated_at);
    byId("study-meta").textContent = parts.join(" · ");
    const warnings = byId("warnings");
    clear(warnings);
    if (data.warnings.length) {
      warnings.appendChild(
        el(
          "details",
          { class: "warning-list" },
          el("summary", { text: data.warnings.length + " export warning" + (data.warnings.length === 1 ? "" : "s") }),
          el("ul", null, data.warnings.map((text) => el("li", { text })))
        )
      );
    }
  }

  function lineageHead() {
    let head = baseline;
    for (const item of candidates) if (item.kept) head = item;
    return head;
  }

  function tile(label, value, delta, deltaClass) {
    return el(
      "div",
      { class: "tile" },
      el("div", { class: "tile-label", text: label }),
      el("div", { class: "tile-value", text: value }),
      delta ? el("div", { class: "tile-delta " + (deltaClass || ""), text: delta }) : null
    );
  }

  function renderTiles() {
    const container = clear(byId("tiles"));
    const counts = {};
    for (const item of candidates) counts[item.outcome] = (counts[item.outcome] || 0) + 1;
    const breakdown = ["keep", "revert", "undecided", "rejected", "pending"]
      .filter((key) => counts[key])
      .map((key) => counts[key] + " " + OUTCOMES[key].label)
      .join(" · ");
    container.appendChild(tile("Candidates", String(candidates.length), breakdown || "none registered yet"));

    const head = lineageHead();
    const metric = state.metric;
    const base = baseline ? stageMean(baseline.revision_id, state.stage, metric) : { mean: null };
    const best = head ? stageMean(head.revision_id, state.stage, metric) : { mean: null };
    const difference = best.mean !== null && base.mean !== null ? best.mean - base.mean : null;
    const goodUp = rule && rule.metric === metric;
    let deltaClass = "";
    if (goodUp && difference !== null && Math.abs(difference) > 1e-12) deltaClass = difference > 0 ? "up" : "down";
    container.appendChild(
      tile(
        "Kept lineage " + metric + " (" + state.stage + ")",
        fmt(best.mean),
        head && head !== baseline ? fmtSigned(difference) + " vs baseline · " + head.label : "no kept candidate yet",
        deltaClass
      )
    );
    const noise = noiseFor(state.stage, metric);
    container.appendChild(
      tile(
        "Baseline " + metric + " (" + state.stage + ")",
        fmt(base.mean),
        noise && noise.null_difference_sd !== null && state.backend === "all"
          ? "no-op spread ±" + fmt(noise.null_difference_sd) + " (1 SD)"
          : base.scored !== undefined
            ? base.scored + " of " + base.runs + " runs scored"
            : null
      )
    );
    const filtered = runs.filter((run) => state.backend === "all" || run.backend_id === state.backend);
    const scored = filtered.filter((run) => numeric(run.metrics[metric]) !== null).length;
    container.appendChild(tile("Runs", String(filtered.length), scored + " with a " + metric + " value"));
    const input = sum(filtered.map((run) => (run.usage ? run.usage.input_tokens : null)));
    const output = sum(filtered.map((run) => (run.usage ? run.usage.output_tokens : null)));
    const cached = sum(filtered.map((run) => (run.usage ? run.usage.cache_read_input_tokens : null)));
    container.appendChild(
      tile(
        "Executor tokens",
        fmtCompact((input || 0) + (output || 0)),
        input ? fmtCompact(output || 0) + " output · " + Math.round((100 * (cached || 0)) / input) + "% of input cached" : null
      )
    );
    const durations = filtered.map((run) => run.duration_seconds).filter((value) => value !== null);
    const sorted = durations.slice().sort((left, right) => left - right);
    container.appendChild(
      tile(
        "Run time",
        fmtDuration(sum(durations)),
        sorted.length ? "median " + fmtDuration(sorted[Math.floor(sorted.length / 2)]) + " per run" : null
      )
    );
    if (iterations.length) {
      const sessions = iterations.flatMap((item) => item.sessions);
      const wall = sum(sessions.map((item) => item.wall_seconds));
      const cost = sum(sessions.map((item) => item.total_cost_usd));
      container.appendChild(
        tile(
          "Meta Agent sessions",
          fmtDuration(wall),
          sessions.length + " sessions" + (cost !== null ? " · $" + cost.toFixed(2) + " reported" : "")
        )
      );
      for (const key of costKeys) {
        const total = sum(iterations.map((item) => (key in item.costs ? item.costs[key] : null)));
        container.appendChild(tile(costUnit(key).label + " cost", fmtCost(key, total), "summed over iterations"));
      }
    }
  }

  function noiseFor(stage, metric) {
    return data.noise.find((item) => item.stage === stage && item.metric === metric) || null;
  }

  // ---------------------------------------------------------------- experiment timeline

  const FIELD_LABELS = {
    dev_rule: "Dev rule",
    starting_point: "Starting point",
    repeats: "Repeats",
    backends: "Backends",
    tasks_removed: "Tasks removed",
    tasks_added: "Tasks added",
    evaluator: "Evaluator",
    evaluator_source: "Evaluator source",
    evaluator_task_configuration: "Task evaluator configuration changed",
    metric_policies: "Metric policies changed",
  };

  function segmentId(segment) {
    return segment.snapshot.study.study_id;
  }

  function segmentHref(segment) {
    return "?segment=" + encodeURIComponent(segmentId(segment)) + "#experiment";
  }

  // Experiment-wide names: candidates are numbered on across Studies (a Study's own iter-001
  // continues the count), and a Study that starts from a revision an earlier one ran calls its
  // starting batch that revision, re-run, instead of a new baseline.
  // Experiment-wide iteration numbers run on in time: a later Study's iteration n is its offset
  // plus n, where the offset is the larger of its starting revision's number and the highest
  // number an earlier Study's candidate took. A revision measured again is marked a re-run.
  const EXPERIMENT_OFFSETS = [];

  function iterationNumber(snapshot, item) {
    const summary = snapshot.iterations.find((entry) => entry.candidate_id === item.key);
    if (summary) return summary.number;
    const match = /^iter-(\d+)$/.exec(item.key);
    return match ? Number(match[1]) : item.order;
  }

  function experimentLabels() {
    const labels = new Map();
    const reruns = new Map();
    let used = 0;
    segments.forEach((segment, index) => {
      const snapshot = segment.snapshot;
      let offset = 0;
      if (index > 0) {
        const start = /^iter-(\d+)/.exec(labels.get(snapshot.study.baseline_revision_id) || "");
        offset = Math.max(start ? Number(start[1]) : 0, used);
      }
      EXPERIMENT_OFFSETS[index] = offset;
      const revisions = [...snapshot.revisions].sort((a, b) => a.order - b.order);
      for (const item of revisions) {
        let label = item.label;
        if (item.role === "candidate") {
          const number = offset + iterationNumber(snapshot, item);
          used = Math.max(used, number);
          label = "iter-" + String(number).padStart(3, "0");
        } else if (item.role === "baseline" && index > 0) {
          const earlier = labels.get(item.revision_id);
          if (earlier) {
            const count = (reruns.get(item.revision_id) || 0) + 1;
            reruns.set(item.revision_id, count);
            label = earlier + (count > 1 ? " (re-run " + count + ")" : " (re-run)");
          }
        }
        labels.set(index + ":" + item.key, label);
        if (!labels.has(item.revision_id) || item.role === "candidate") labels.set(item.revision_id, label);
      }
    });
    return labels;
  }
  const EXPERIMENT_LABELS = experimentLabels();

  // Two segments score alike when they share the evaluator, its source, the metric's policy and,
  // for every task both ran, the task's evaluator and private configuration.
  function sameScoring(left, right, metric) {
    const a = left.study.evaluator;
    const b = right.study.evaluator;
    if (a.code_digest !== b.code_digest || a.source_sha256 !== b.source_sha256) return false;
    const policy = (snapshot) => (snapshot.study.metrics.find((item) => item.name === metric) || {}).policy_sha256;
    if (!policy(left) || policy(left) !== policy(right)) return false;
    const tasks = new Map(left.tasks.map((task) => [task.task_id, task]));
    return right.tasks.every((task) => {
      const other = tasks.get(task.task_id);
      return !other || (other.evaluator_config_sha256 === task.evaluator_config_sha256 && other.private_configuration_sha256 === task.private_configuration_sha256);
    });
  }

  function segmentRuns(snapshot, revisionId, stage, tasks) {
    return snapshot.runs.filter((run) => run.revision_id === revisionId && run.stage === stage && (!tasks || tasks.has(stage + ":" + run.task_id)));
  }

  function taskMeans(snapshot, revisionId, stage, metric, tasks) {
    const byTask = new Map();
    for (const run of segmentRuns(snapshot, revisionId, stage, tasks)) {
      const value = numeric(run.metrics[metric]);
      if (value === null) continue;
      if (!byTask.has(run.task_id)) byTask.set(run.task_id, []);
      byTask.get(run.task_id).push(value);
    }
    return new Map([...byTask].map(([task, values]) => [task, mean(values)]));
  }

  function experimentLabel(point) {
    return EXPERIMENT_LABELS.get(point.segment + ":" + point.item.key) || point.item.label;
  }

  // Each segment's admitted revisions in registration order, with their mean for the selected
  // stage and metric, laid out one after another along a single axis.
  function experimentPoints() {
    const points = [];
    let x = 0;
    segments.forEach((segment, index) => {
      const revisions = segment.snapshot.revisions
        .filter((item) => item.role !== "official_baseline" && (item.status === "admitted" || item.role === "baseline"))
        .sort((left, right) => left.order - right.order);
      for (const item of revisions) {
        const score = item.scores.find((entry) => entry.stage === state.stage && entry.metric === state.metric);
        points.push({ x: x++, segment: index, item, mean: score ? score.mean : null });
      }
      // A Meta Agent change whose first candidate is not registered yet gets an empty slot.
      if (metaChangeXs(segment, points.filter((point) => point.segment === index), identity).some((value) => value === null)) x += 1;
      x += 0.6;
    });
    points.extent = x - 1.6;
    return points;
  }

  function renderExperiment() {
    if (segments.length < 2) return;
    byId("experiment").hidden = false;
    byId("experiment-link").hidden = false;
    byId("experiment-note").textContent =
      "Experiment " + experiment.experiment_id + ": " + segments.length + " Studies in order. Each Study keeps its own runs and rule; " +
      "a dashed marker between Studies is a change, listed below. Every value and keep/revert outcome is that Study's own record under its own rule; " +
      "nothing is recomputed under a later Study's settings. The stage filter applies to every Study. The sections after this one show the selected Study.";
    const tabs = clear(byId("segment-tabs"));
    segments.forEach((segment, index) => {
      const current = segment === chosen;
      tabs.appendChild(
        el(
          "a",
          { class: "segment-tab" + (current ? " current" : ""), href: segmentHref(segment), "aria-current": current ? "page" : null },
          el("span", { text: index + 1 + ". " + segmentId(segment) }),
          segment.source === "archive" ? el("span", { class: "subtle", text: " archived" }) : null
        )
      );
    });
    const points = experimentPoints();
    chartCard(
      byId("experiment-card"),
      state.metric + " · " + state.stage + " mean across the experiment",
      "all backends",
      (body) => drawExperimentChart(body, points),
      (body) =>
        body.appendChild(
          table(
            [{ label: "Study" }, { label: "Revision" }, { label: "In its Study" }, { label: "Outcome" }, { label: "Mean", num: true }],
            points.map((point) =>
              el(
                "tr",
                null,
                el("td", { class: "mono", text: segmentId(segments[point.segment]) }),
                el("td", { text: experimentLabel(point) }),
                el("td", { class: "subtle", text: point.item.label }),
                el("td", null, outcomeBadge(point.item.outcome)),
                el("td", { class: "num", text: fmt(point.mean) })
              )
            )
          )
        )
    );
    const changes = clear(byId("experiment-changes"));
    experiment.changes.forEach((change, index) => changes.appendChild(changeCard(change, index)));
    segments.forEach((segment) => {
      for (const change of segment.snapshot.meta_agent_changes) changes.appendChild(metaChangeCard(segment, change, segments.indexOf(segment)));
    });
  }

  // Where a Meta Agent change sits in a segment's run of points: just before the first candidate
  // the changed configuration wrote, or after the last point while that candidate is not registered.
  const identity = (value) => value;

  function metaChangeXs(segment, own, xOf) {
    const numbers = new Map(segment.snapshot.iterations.filter((item) => item.candidate_id).map((item) => [item.candidate_id, item.number]));
    return segment.snapshot.meta_agent_changes.map((change) => {
      const next = own.findIndex((point) => point.item.role === "candidate" && (numbers.get(point.item.key) || 0) >= change.iteration);
      if (next < 0 && xOf === identity) return null;
      if (next < 0) return xOf(own[own.length - 1].x + 0.5);
      if (next === 0) return xOf(own[0].x) - 8;
      return (xOf(own[next - 1].x) + xOf(own[next].x)) / 2;
    });
  }

  // One Meta Agent configuration change: chips for what was added, removed or rewritten.
  const META_DIGESTS = [
    ["instructions", "Instructions"],
    ["settings", "Settings"],
    ["prompt", "Prompt"],
    ["reference_files", "Reference files"],
  ];

  function metaChangeCard(segment, change, index) {
    const fields = new Map(change.items.map((item) => [item.field, item]));
    const chip = (text, cls, title) => {
      const node = el("span", { class: "change-chip " + cls, text });
      if (title) node.title = title;
      return node;
    };
    const split = (name) => (fields.has(name) ? fields.get(name).after.split(", ") : []);
    const after = change.after;
    const rows = [];
    const row = (label, nodes) => rows.push(el("div", { class: "meta-row" }, el("span", { class: "rule-name", text: label }), el("div", { class: "change-chips" }, nodes)));
    const setting = (name, label, value) =>
      fields.has(name) && change.before
        ? chip(label + ": " + (fields.get(name).before || DASH) + " → " + (value ?? DASH), "changed")
        : chip(label + ": " + (value ?? DASH), "same");
    row("Model", [setting("model", "model", after.model), setting("effort", "effort", after.effort), setting("session_minutes", "session", after.session_minutes === null ? null : fmt(after.session_minutes, 0) + " min")]);
    const added = split("tools_added");
    const removed = split("tools_removed");
    const kept = after.tools.filter((name) => !added.includes(name));
    row("Tools", [
      ...(change.before ? added.map((name) => chip("+ " + name, "changed")) : []),
      ...removed.map((name) => chip("− " + name, "warn")),
      ...(change.before ? kept : after.tools).map((name) => chip(name, "same")),
    ]);
    const plugins = change.before ? split("plugins_added") : after.plugin_dirs.map((path) => path.split("/").pop());
    const skills = [
      ...plugins.map((name) => chip("+ plugin " + name, "changed")),
      ...split("plugins_removed").map((name) => chip("− plugin " + name, "warn")),
    ];
    const on = split("skills_turned_on");
    const off = change.before ? split("skills_turned_off") : after.off_skills;
    if (on.length) skills.push(chip("+ " + on.length + " skills turned on", "changed", on.join(", ")));
    if (off.length) skills.push(chip("− " + off.length + " skills turned off", change.before ? "warn" : "same", off.join(", ")));
    if (!skills.length) skills.push(chip("✓ unchanged", "same"));
    row("Skills", skills);
    if (change.before) {
      row("Text", META_DIGESTS.map(([name, label]) => (fields.has(name) ? chip("● " + label + " rewritten", "changed", fields.get(name).after || "") : chip("✓ " + label, "same"))));
    }
    return el(
      "div",
      { class: "card change-card" },
      el("div", { class: "card-head" }, el("h3", { text: "Meta Agent change · from iter-" + String((EXPERIMENT_OFFSETS[index] || 0) + change.iteration).padStart(3, "0") + " (" + segmentId(segment) + " iter-" + String(change.iteration).padStart(3, "0") + ")" })),
      el("div", { class: "change-chips" }, chip("◆ Meta Agent changed", "changed"), chip("Executor and scoring unchanged by this", "same")),
      el(
        "p",
        { class: "change-lede", text: change.before
          ? "The Meta Agent that writes candidates changed here; the Harness candidates before and after came from different Meta Agents."
          : "Earlier iterations did not record their Meta Agent configuration; this is the first recorded one." }
      ),
      el("div", { class: "meta-rows" }, rows)
    );
  }

  // One change between two Studies, drawn rather than listed: status chips, the keep rule before
  // and after as bars, where the new Study starts in the old lineage, and what stayed the same.
  const COMPARED = [
    ["tasks", "Tasks", ["tasks_added", "tasks_removed"]],
    ["evaluator", "Evaluator", ["evaluator", "evaluator_source"]],
    ["grading", "Task grading config", ["evaluator_task_configuration"]],
    ["policies", "Metric policies", ["metric_policies"]],
    ["backends", "Backends", ["backends"]],
    ["repeats", "Repeats", ["repeats"]],
  ];

  function changeCard(change, index) {
    const before = segments[index].snapshot;
    const after = segments[index + 1].snapshot;
    const fields = new Map(change.items.map((item) => [item.field, item]));
    const chip = (text, cls) => el("span", { class: "change-chip " + cls, text });
    const chips = [];
    if (fields.has("dev_rule")) chips.push(chip("Keep rule changed", "changed"));
    if (fields.has("starting_point")) chips.push(chip("New starting point", "changed"));
    chips.push(change.evaluator_changed ? chip("⚠ Scores not comparable", "warn") : chip("✓ Scores comparable", "same"));
    // The note's first sentence is its headline; the whole note stays one click away.
    let firstSentence = change.note ? change.note.split(/(?<=\.)\s/)[0] : null;
    if (firstSentence && firstSentence.length > 200) firstSentence = firstSentence.slice(0, 200).replace(/\s+\S*$/, "") + " …";
    const panels = el("div", { class: "change-panels" });
    if (fields.has("dev_rule")) panels.appendChild(el("div", { class: "change-panel" }, el("h4", { text: "Keep rule" }), ruleBars(before.study.dev_rule, after.study.dev_rule)));
    if (fields.has("starting_point")) panels.appendChild(el("div", { class: "change-panel" }, el("h4", { text: "Starting point" }), startDiagram(before, after)));
    const transfer = transferPanel(before, after, index);
    if (transfer) panels.appendChild(transfer);
    const other = COMPARED.map(([key, label, names]) => {
      const changed = names.filter((name) => fields.has(name));
      if (!changed.length) return chip("✓ " + label, "same");
      const detail = changed.map((name) => (FIELD_LABELS[name] || name) + ": " + (fields.get(name).after || DASH)).join("; ");
      const node = chip("● " + label + " changed", "changed");
      node.title = detail;
      return node;
    });
    return el(
      "div",
      { class: "card change-card" },
      el("div", { class: "card-head" }, el("h3", { text: "Change " + (index + 1) + " · " + change.before_study_id + " → " + change.after_study_id })),
      el("div", { class: "change-chips" }, chips),
      firstSentence ? el("p", { class: "change-lede", text: firstSentence }) : null,
      panels,
      el("div", { class: "change-chips" }, el("span", { class: "subtle", text: "Also compared:" }), other),
      change.note && change.note !== firstSentence
        ? el("details", { class: "change-note" }, el("summary", { text: "Full note" }), el("p", { class: "prose", text: change.note }))
        : null
    );
  }

  // The earlier Study's candidates measured on the next Study's dev tasks, against the next
  // Study's bar. Only when both score alike; it is a reference, not a decision of either Study.
  function transferPanel(before, after, index) {
    const rule = after.study.dev_rule;
    const metric = rule ? rule.metric : "score";
    if (!sameScoring(before, after, metric)) return null;
    const tasks = new Set(after.tasks.filter((task) => task.stage === "dev").map((task) => "dev:" + task.task_id));
    if (!tasks.size) return null;
    const base = taskMeans(before, before.study.baseline_revision_id, "dev", metric, tasks);
    if (!base.size) return null;
    const rows = [];
    for (const item of [...before.revisions].sort((a, b) => a.order - b.order)) {
      if (item.role !== "candidate" || item.status !== "admitted") continue;
      const own = taskMeans(before, item.revision_id, "dev", metric, tasks);
      const shared = [...own.keys()].filter((task) => base.has(task));
      if (!shared.length) continue;
      rows.push({ label: EXPERIMENT_LABELS.get(index + ":" + item.key) || item.label, value: mean(shared.map((task) => own.get(task) - base.get(task))), tasks: shared.length });
    }
    if (!rows.length) return null;
    // A logit bar is not on the raw score scale these differences use.
    const bar = rule && !isLogit(rule) ? rule.min_mean_difference : null;
    const values = rows.map((row) => row.value).concat(bar === null ? [] : [bar], [0]);
    const low = Math.min(...values) - 0.01;
    const high = Math.max(...values) + 0.01;
    const width = 360;
    const left = 92;
    const right = 60;
    const xOf = (value) => left + ((value - low) / (high - low)) * (width - left - right);
    const height = rows.length * 24 + 34;
    const root = svg("svg", { class: "transfer-chart", viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": metric + " difference from the starting revision on " + after.study.study_id + "'s dev tasks" });
    root.appendChild(svg("line", { class: "axisline", x1: xOf(0), x2: xOf(0), y1: 6, y2: height - 22 }));
    rows.forEach((row, step) => {
      const y = 10 + step * 24;
      root.appendChild(svg("text", { class: "start-label", x: left - 8, y: y + 11, "text-anchor": "end", text: row.label }));
      const from = Math.min(xOf(0), xOf(row.value));
      root.appendChild(svg("rect", { class: row.value >= 0 ? "transfer-bar" : "transfer-bar negative", x: from, y, width: Math.max(1, Math.abs(xOf(row.value) - xOf(0))), height: 14, rx: 2 }));
      root.appendChild(svg("text", { class: "start-label", x: Math.max(xOf(row.value), xOf(0)) + 4, y: y + 11, text: fmtSigned(row.value) }));
    });
    if (bar !== null) {
      root.appendChild(svg("line", { class: "threshold", x1: xOf(bar), x2: xOf(bar), y1: 4, y2: height - 22 }));
      root.appendChild(svg("text", { class: "start-label", x: xOf(bar), y: height - 8, "text-anchor": "middle", text: "bar +" + fmt(bar, 4) }));
    }
    root.appendChild(svg("text", { class: "start-label", x: xOf(0), y: height - 8, "text-anchor": "middle", text: "0" }));
    return el(
      "div",
      { class: "change-panel" },
      el("h4", { text: "Earlier candidates on " + after.study.study_id + "'s dev tasks" }),
      root,
      el("p", {
        class: "subtle transfer-note",
        text: metric + " minus " + (EXPERIMENT_LABELS.get(index + ":@baseline") || "the starting revision") + " on the " + tasks.size + " dev tasks of " + after.study.study_id +
          ", each task's mean over its runs; no time price. A reference only: " + after.study.study_id + " did not decide these candidates.",
      })
    );
  }

  // Each rule parameter on its own row and scale: grey bar before, blue bar after.
  function ruleBars(left, right) {
    const rows = [
      { label: "Score threshold θ", pick: (rule) => (isLogit(rule) ? undefined : rule.min_mean_difference), show: (v) => fmt(v, 4), none: "none" },
      { label: "Price per slower minute", pick: (rule) => (isLogit(rule) ? undefined : rule.wall_time_price_per_minute || null), show: (v) => fmt(v, 4), none: "free" },
      { label: "Logit bar L", pick: (rule) => (isLogit(rule) ? rule.logit_bar : undefined), show: (v) => fmt(v, 4), none: "none" },
      { label: "Cost weight λ", pick: (rule) => (isLogit(rule) ? rule.cost_weight || null : undefined), show: (v) => fmt(v, 4), none: "free" },
      { label: "Median run cap", pick: (rule) => rule.max_median_wall_minutes, show: (v) => fmt(v, 0) + " min", none: "no cap" },
    ];
    const grid = el("div", { class: "rule-grid" }, el("span"), el("span", { class: "subtle", text: "before" }), el("span", { class: "subtle", text: "after" }));
    for (const row of rows) {
      const values = [left, right].map((rule) => (rule ? row.pick(rule) : undefined));
      // A parameter neither rule has (a V7 bar between two V5 rules) gets no row.
      if (values.every((value) => value === undefined)) continue;
      const top = Math.max(...values.filter((v) => typeof v === "number" && v > 0), 1e-9);
      grid.appendChild(el("span", { class: "rule-name", text: row.label }));
      values.forEach((value, side) => {
        const rule = side ? right : left;
        let text;
        if (rule === null) text = side ? "not frozen yet" : "no rule";
        else if (value === undefined) text = "n/a for this rule";
        else if (value === null || value === 0) text = row.none;
        else text = row.show(value);
        const share = typeof value === "number" && value > 0 ? Math.max(4, (100 * value) / top) : 0;
        const bar = share ? el("span", { class: side ? "rule-bar after" : "rule-bar" }) : null;
        if (bar) bar.style.width = share + "%"; // CSSOM: the page's CSP forbids style attributes
        grid.appendChild(
          el(
            "span",
            { class: "rule-cell" },
            bar,
            el("span", { class: rule === null || !share ? "rule-text muted" : "rule-text", text })
          )
        );
      });
    }
    return grid;
  }

  // The earlier Study's revisions as a row of dots coloured by outcome; the one the next Study
  // starts from is ringed and an arrow leads into the next Study.
  function startDiagram(before, after) {
    const revisions = before.revisions
      .filter((item) => item.role !== "official_baseline" && (item.status === "admitted" || item.role === "baseline"))
      .sort((a, b) => a.order - b.order);
    const step = 70;
    const width = Math.max(300, revisions.length * step + 170);
    const root = svg("svg", { class: "start-diagram", viewBox: "0 0 " + width + " 96", role: "img", "aria-label": "Where the next Study starts in the earlier Study's lineage" });
    root.appendChild(svg("text", { class: "rule-label", x: 10, y: 14, text: before.study.study_id }));
    let startX = null;
    revisions.forEach((item, index) => {
      const x = 24 + index * step;
      if (index) root.appendChild(svg("line", { class: item.kept ? "lineage" : "branch", x1: x - step + 8, y1: 46, x2: x - 8, y2: 46 }));
      root.appendChild(svg("circle", { class: "dot " + item.outcome, cx: x, cy: 46, r: 7 }));
      root.appendChild(svg("text", { class: "start-label", x, y: 72, "text-anchor": "middle", text: truncate(item.label, 9) }));
      if (item.revision_id === after.study.baseline_revision_id) {
        startX = x;
        root.appendChild(svg("circle", { class: "start-ring", cx: x, cy: 46, r: 12 }));
      }
    });
    const endX = width - 112;
    root.appendChild(svg("rect", { class: "start-target", x: endX - 6, y: 28, width: 112, height: 36, rx: 6 }));
    root.appendChild(svg("text", { class: "start-label strong", x: endX + 50, y: 51, "text-anchor": "middle", text: truncate(after.study.study_id, 14) }));
    if (startX !== null) {
      root.appendChild(svg("path", { class: "start-arrow", d: "M" + (startX + 12) + ",40 C" + (startX + 60) + ",8 " + (endX - 40) + ",8 " + (endX - 8) + ",40" }));
      root.appendChild(svg("path", { class: "start-arrowhead", d: "M" + (endX - 14) + ",36 L" + (endX - 6) + ",42 L" + (endX - 15) + ",44 Z" }));
    }
    return root;
  }

  // One line per Meta Agent change: what it changed, in words.
  function metaSummary(change) {
    if (!change.before) {
      const after = change.after;
      return "first recorded configuration: " + [after.model, after.effort ? after.effort + " effort" : null, after.tools.length + " tools", after.plugin_dirs.length ? after.plugin_dirs.map((path) => path.split("/").pop()).join(", ") + " plugin" : null].filter(Boolean).join(", ");
    }
    return change.items
      .map((item) => {
        const label = FIELD_LABELS[item.field] || item.field.replace(/_/g, " ");
        if (["model", "effort", "session_minutes"].includes(item.field)) return label + " " + (item.before || DASH) + " → " + (item.after || DASH);
        if (/_added$|_removed$|^skills_turned/.test(item.field)) return label + ": " + item.after;
        return label + " rewritten";
      })
      .join("; ");
  }

  function drawExperimentChart(body, points) {
    const metaKeys = [];
    const plotted = points.filter((point) => point.mean !== null);
    if (!plotted.length) {
      body.appendChild(el("p", { class: "empty-state", text: "No revision has a " + state.stage + " " + state.metric + " value yet." }));
      return;
    }
    const width = Math.max(320, body.clientWidth || 640);
    const height = 320;
    const margin = { top: 30, right: 24, bottom: 56, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxX = Math.max(1, points.extent ?? 0, ...points.map((point) => point.x));
    const means = plotted.map((point) => point.mean);
    const pad = Math.max((Math.max(...means) - Math.min(...means)) * 0.15, 0.02);
    const scale = niceTicks(Math.max(0, Math.min(...means) - pad), Math.max(...means) + pad);
    const xOf = (x) => margin.left + 12 + (x / maxX) * (innerWidth - 24);
    const yOf = (y) => margin.top + innerHeight - ((y - scale.low) / (scale.high - scale.low)) * innerHeight;
    const root = svg("svg", { width, height, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": state.metric + " " + state.stage + " mean across the experiment" });
    for (const tick of scale.ticks) {
      root.appendChild(svg("line", { class: "gridline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(tick), y2: yOf(tick) }));
      root.appendChild(svg("text", { x: margin.left - 8, y: yOf(tick) + 4, "text-anchor": "end", text: fmt(tick, scale.step < 0.01 ? 3 : 2) }));
    }
    root.appendChild(svg("line", { class: "axisline", x1: margin.left, x2: margin.left + innerWidth, y1: margin.top + innerHeight, y2: margin.top + innerHeight }));
    segments.forEach((segment, index) => {
      const own = points.filter((point) => point.segment === index);
      if (!own.length) return;
      const left = xOf(own[0].x) - 10;
      const right = xOf(own[own.length - 1].x) + 10;
      root.appendChild(svg("rect", { class: segment === chosen ? "segment-band current" : "segment-band", x: left, y: margin.top, width: right - left, height: innerHeight }));
      root.appendChild(svg("text", { class: "end-label", x: (left + right) / 2, y: margin.top - 10, "text-anchor": "middle", text: truncate(segmentId(segment), 22) }));
      if (index > 0) {
        const change = experiment.changes[index - 1];
        const previous = points.filter((point) => point.segment === index - 1);
        const at = previous.length ? (xOf(previous[previous.length - 1].x) + left) / 2 + 5 : left;
        root.appendChild(svg("line", { class: "threshold", x1: at, x2: at, y1: margin.top, y2: margin.top + innerHeight }));
        const marker = svg("text", { class: "end-label", x: at, y: margin.top + innerHeight + 34, "text-anchor": "middle", text: (change && change.evaluator_changed ? "⚠ " : "") + "change " + index });
        root.appendChild(marker);
      }
      metaChangeXs(segment, own, xOf).forEach((at, step) => {
        const change = segment.snapshot.meta_agent_changes[step];
        const number = "iter-" + String((EXPERIMENT_OFFSETS[index] || 0) + change.iteration).padStart(3, "0");
        const name = "M" + (metaKeys.length + 1);
        // Two changes in one gap (an iteration without a candidate) share a line; stack their names.
        const stacked = metaKeys.filter((key) => Math.abs(key.at - at) < 1).length;
        metaKeys.push({ name, number, at, summary: metaSummary(change) });
        root.appendChild(svg("text", { class: "meta-change-name", x: at + 8, y: margin.top + 12 + stacked * 14, text: name }));
        root.appendChild(svg("line", { class: "meta-change", x1: at, x2: at, y1: margin.top, y2: margin.top + innerHeight }));
        const mark = svg("path", { class: "meta-change-mark", d: "M" + at + "," + (margin.top - 2) + " l5,5 l-5,5 l-5,-5 Z", tabindex: "0", "aria-label": "Meta Agent changed from " + number });
        hoverable(mark, () => [tipLabel("Meta Agent changed from " + number), tipLabel(change.items.length ? change.items.map((item) => FIELD_LABELS[item.field] || item.field.replace(/_/g, " ")).join(", ") : "first recorded configuration")]);
        root.appendChild(mark);
      });
      const lineage = own.filter((point) => point.item.kept && point.mean !== null);
      if (lineage.length > 1) {
        root.appendChild(svg("path", { class: "lineage", d: lineage.map((point, step) => (step ? "L" : "M") + xOf(point.x) + "," + yOf(point.mean)).join("") }));
      }
      for (const point of own) {
        if (point.mean === null || point.item.kept || !point.item.parent_revision_id) continue;
        const parent = own.find((entry) => entry.item.revision_id === point.item.parent_revision_id && entry.mean !== null);
        if (parent) root.appendChild(svg("line", { class: "branch", x1: xOf(parent.x), y1: yOf(parent.mean), x2: xOf(point.x), y2: yOf(point.mean) }));
      }
      // A Study that starts from a revision an earlier Study ran measures it again: join the two.
      const start = own.find((point) => point.item.role === "baseline");
      if (index > 0 && start && start.mean !== null) {
        const earlier = points.filter((point) => point.segment < index && point.item.revision_id === start.item.revision_id && point.mean !== null).pop();
        if (earlier) root.appendChild(svg("line", { class: "connector", x1: xOf(earlier.x), y1: yOf(earlier.mean), x2: xOf(start.x), y2: yOf(start.mean) }));
      }
    });
    for (const point of plotted) {
      const cx = xOf(point.x);
      const cy = yOf(point.mean);
      root.appendChild(svg("circle", { class: "dot " + point.item.outcome, cx, cy, r: point.item.role === "candidate" ? 5 : 6 }));
      const hit = svg("circle", { class: "hit", cx, cy, r: 12, tabindex: "0", role: "link", "aria-label": segmentId(segments[point.segment]) + " " + experimentLabel(point) + ", mean " + fmt(point.mean) });
      hoverable(hit, () => [
        tipValue(fmt(point.mean) + " " + state.metric),
        el("div", { class: "tt-row" }, outcomeBadge(point.item.outcome), el("span", { class: "tt-label", text: experimentLabel(point) })),
        tipLabel("Study " + segmentId(segments[point.segment]) + (experimentLabel(point) !== point.item.label ? ", where it is " + point.item.label : "")),
        point.item.hypothesis ? tipText(truncate(point.item.hypothesis, 200)) : null,
      ].filter(Boolean));
      hit.addEventListener("click", () => {
        window.location.href = segmentHref(segments[point.segment]);
      });
      root.appendChild(hit);
    }
    const labelled = thinLabels(points.map((point) => xOf(point.x)), 60);
    points.forEach((point, index) => {
      if (labelled.has(index)) root.appendChild(svg("text", { x: xOf(point.x), y: margin.top + innerHeight + 16, "text-anchor": "middle", text: truncate(experimentLabel(point), 20) }));
    });
    body.appendChild(
      legend([
        { key: lineKey("bg-lineage"), label: "kept lineage" },
        { key: lineKey("bg-branch"), label: "branch to parent" },
        { key: el("span", { class: "key-dash", "aria-hidden": "true" }), label: "change between Studies" },
        ...(metaKeys.length ? [{ key: el("span", { class: "key-dash meta-key", "aria-hidden": "true" }), label: "Meta Agent changed" }] : []),
        { key: lineKey("bg-connector"), label: "same revision measured again" },
      ])
    );
    body.appendChild(root);
    if (metaKeys.length) {
      body.appendChild(
        el(
          "ul",
          { class: "meta-key-list" },
          metaKeys.map((key) => el("li", null, el("span", { class: "meta-key-name", text: "◆ " + key.name }), el("span", { text: " Meta Agent changed from " + key.number + ": " + key.summary })))
        )
      );
    }
  }

  // ---------------------------------------------------------------- score curves

  function scorePoints() {
    const stage = state.stage;
    const metric = state.metric;
    const points = [];
    if (baseline) {
      points.push({ x: 0, item: baseline, ...stageMean(baseline.revision_id, stage, metric) });
    }
    for (const item of candidates) {
      const stats = item.status === "admitted" ? stageMean(item.revision_id, stage, metric) : { mean: null, scored: 0, runs: 0 };
      points.push({ x: item.order, item, ...stats });
    }
    const byKey = new Map(points.map((point) => [point.item.key, point]));
    for (const point of points) {
      const parent = point.item.parent_revision_id ? byRevisionId.get(point.item.parent_revision_id) : null;
      point.parent = parent ? byKey.get(parent.key) || null : null;
      point.difference =
        point.parent && point.mean !== null && point.parent.mean !== null ? point.mean - point.parent.mean : null;
    }
    return points;
  }

  function scoreTooltip(point) {
    const item = point.item;
    const nodes = [
      tipValue(fmt(point.mean) + (point.mean === null ? "" : " " + state.metric)),
      el("div", { class: "tt-row" }, outcomeBadge(item.outcome), el("span", { class: "tt-label", text: item.label })),
      tipLabel(point.scored + " of " + point.runs + " " + state.stage + " runs scored"),
    ];
    if (point.parent) nodes.push(tipLabel(fmtSigned(point.difference) + " vs parent " + point.parent.item.label));
    if (item.decision) {
      const decision = item.decision;
      nodes.push(tipLabel("dev decision: " + decisionText(decision)));
    }
    if (item.failure_code) nodes.push(tipLabel("rejected: " + item.failure_code));
    if (item.hypothesis) nodes.push(tipText(truncate(item.hypothesis, 240)));
    return nodes;
  }

  function renderScores() {
    const container = byId("score-card");
    const stage = state.stage;
    const metric = state.metric;
    const noise = state.backend === "all" ? noiseFor(stage, metric) : null;
    const showBar = stage === "dev" && rule && rule.metric === metric;
    byId("scores-note").textContent =
      "The blue line follows the kept lineage from the baseline; other candidates branch from their parent. " +
      (noise && noise.null_difference_sd !== null
        ? "Shaded bands are ±1 and ±2 SD of a no-op candidate's " + stage + " mean around the baseline, from the baseline's repeat spread. "
        : "") +
      (showBar
        ? "The dashed step is each candidate's keep bar: its parent's dev mean plus the frozen threshold" +
          (isLogit(rule)
            ? ", once decided: its parent's mean plus the logit bar on the raw scale at that mean (the cost term is not drawn)."
            : rule.wall_time_price_per_minute ? ", plus the price of each minute its median run is slower." : ".")
        : "");
    const points = scorePoints();
    chartCard(
      container,
      metric + " · " + stage + " mean per revision",
      state.backend === "all" ? "all backends" : state.backend,
      (body) => drawScoreChart(body, points, noise, showBar),
      (body) => drawScoreTable(body, points)
    );
  }

  function renderScoreTime() {
    const container = byId("score-time-card");
    const points = scorePoints()
      .map((point) => ({ ...point, ...medianMinutes(point.item.revision_id, state.stage) }))
      .filter((point) => point.item.status === "admitted" || point.item === baseline);
    chartCard(
      container,
      state.metric + " · " + state.stage + " mean against median run time",
      state.backend === "all" ? "all backends" : state.backend,
      (body) => drawScoreTime(body, points),
      (body) =>
        body.appendChild(
          table(
            [{ label: "Revision" }, { label: "Outcome" }, { label: "Median run", num: true }, { label: "Timed runs", num: true }, { label: "Mean", num: true }],
            points.map((point) =>
              el(
                "tr",
                { class: "clickable", tabindex: "0", on: { click: () => openRevision(point.item) } },
                el("td", { text: point.item.label }),
                el("td", null, outcomeBadge(point.item.outcome)),
                el("td", { class: "num", text: point.minutes === null ? DASH : fmt(point.minutes, 1) + " min" }),
                el("td", { class: "num", text: String(point.timed) }),
                el("td", { class: "num", text: fmt(point.mean) })
              )
            )
          )
        )
    );
  }

  function drawScoreTime(body, points) {
    const plotted = points.filter((point) => point.mean !== null && point.minutes !== null);
    if (!plotted.length) {
      body.appendChild(el("p", { class: "empty-state", text: "No revision has both " + state.stage + " run times and " + state.metric + " values yet." }));
      return;
    }
    const width = Math.max(320, body.clientWidth || 640);
    const height = 300;
    const margin = { top: 16, right: 24, bottom: 48, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const capMinutes = state.stage === "dev" && rule && rule.max_median_wall_minutes !== null ? rule.max_median_wall_minutes : 0;
    const xScale = niceTicks(0, Math.max(capMinutes, ...plotted.map((point) => point.minutes)) * 1.1 || 1);
    const means = plotted.map((point) => point.mean);
    const pad = Math.max((Math.max(...means) - Math.min(...means)) * 0.15, 0.02);
    const yScale = niceTicks(Math.max(0, Math.min(...means) - pad), Math.max(...means) + pad);
    const xOf = (x) => margin.left + ((x - xScale.low) / (xScale.high - xScale.low)) * innerWidth;
    const yOf = (y) => margin.top + innerHeight - ((y - yScale.low) / (yScale.high - yScale.low)) * innerHeight;
    const root = svg("svg", { width, height, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": state.metric + " mean against median run time" });
    for (const tick of yScale.ticks) {
      root.appendChild(svg("line", { class: "gridline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(tick), y2: yOf(tick) }));
      root.appendChild(svg("text", { x: margin.left - 8, y: yOf(tick) + 4, "text-anchor": "end", text: fmt(tick, yScale.step < 0.01 ? 3 : 2) }));
    }
    for (const tick of xScale.ticks) {
      root.appendChild(svg("text", { x: xOf(tick), y: margin.top + innerHeight + 18, "text-anchor": "middle", text: fmt(tick, 0) }));
    }
    root.appendChild(svg("line", { class: "axisline", x1: margin.left, x2: margin.left + innerWidth, y1: margin.top + innerHeight, y2: margin.top + innerHeight }));
    root.appendChild(svg("text", { x: margin.left + innerWidth / 2, y: height - 8, "text-anchor": "middle", text: "median " + state.stage + " run (minutes)" }));
    const cap = state.stage === "dev" && rule ? rule.max_median_wall_minutes : null;
    if (cap !== null && cap <= xScale.high) {
      root.appendChild(svg("line", { class: "threshold", x1: xOf(cap), x2: xOf(cap), y1: margin.top, y2: margin.top + innerHeight }));
      root.appendChild(svg("text", { class: "end-label", x: xOf(cap) - 6, y: margin.top + 12, "text-anchor": "end", text: "cap " + cap + " min" }));
    }
    const byKey = new Map(plotted.map((point) => [point.item.key, point]));
    for (const point of plotted) {
      const parent = point.parent && byKey.get(point.parent.item.key);
      if (!parent) continue;
      root.appendChild(svg("line", { class: point.item.kept ? "lineage" : "branch", x1: xOf(parent.minutes), y1: yOf(parent.mean), x2: xOf(point.minutes), y2: yOf(point.mean) }));
    }
    for (const point of plotted) {
      const cx = xOf(point.minutes);
      const cy = yOf(point.mean);
      root.appendChild(svg("circle", { class: "dot " + point.item.outcome, cx, cy, r: point.item.role === "candidate" ? 5 : 6 }));
      root.appendChild(svg("text", { class: "end-label", x: cx + 9, y: cy - 7, text: truncate(point.item.label, 14) }));
      const hit = svg("circle", { class: "hit", cx, cy, r: 13, tabindex: "0", role: "button", "aria-label": point.item.label + ", median " + fmt(point.minutes, 1) + " min, mean " + fmt(point.mean) });
      hoverable(hit, () => [tipLabel("median run " + fmt(point.minutes, 1) + " min over " + point.timed + " runs"), ...scoreTooltip(point)]);
      hit.addEventListener("click", () => openRevision(point.item));
      root.appendChild(hit);
    }
    const items = [{ key: lineKey("bg-lineage"), label: "kept lineage" }, { key: lineKey("bg-branch"), label: "branch to parent" }];
    if (cap !== null && cap <= xScale.high) items.push({ key: el("span", { class: "key-dash", "aria-hidden": "true" }), label: "median time cap" });
    const present = new Set(plotted.map((point) => point.item.outcome));
    for (const outcome of ["keep", "revert", "undecided", "pending"]) {
      if (present.has(outcome)) {
        items.push({ key: el("span", { class: "status-icon " + outcome, "aria-hidden": "true", text: OUTCOMES[outcome].icon }), label: OUTCOMES[outcome].label });
      }
    }
    body.appendChild(legend(items));
    body.appendChild(root);
  }

  function drawScoreTable(body, points) {
    const rows = points.map((point) =>
      el(
        "tr",
        { class: "clickable", tabindex: "0", on: { click: () => openRevision(point.item) } },
        el("td", { class: "num", text: String(point.x) }),
        el("td", { text: point.item.label }),
        el("td", null, outcomeBadge(point.item.outcome)),
        el("td", { class: "num", text: fmt(point.mean) }),
        el("td", { class: "num", text: point.scored + "/" + point.runs }),
        el("td", { class: "num", text: fmtSigned(point.difference) }),
        el("td", {
          class: "num",
          text: point.item.decision ? fmtSigned(decisionValue(point.item.decision)) + " / " + fmtSigned(barOf(point.item.decision)) : DASH,
        })
      )
    );
    body.appendChild(
      table(
        [
          { label: "#", num: true },
          { label: "Revision" },
          { label: "Outcome" },
          { label: "Mean", num: true },
          { label: "Scored", num: true },
          { label: "Δ vs parent", num: true },
          { label: "Dev Δ / bar", num: true },
        ],
        rows
      )
    );
  }

  function drawScoreChart(body, points, noise, showBar) {
    const plotted = points.filter((point) => point.mean !== null);
    if (!plotted.length) {
      body.appendChild(el("p", { class: "empty-state", text: "No " + state.stage + " run of any revision has a " + state.metric + " value yet." }));
      return;
    }
    const width = Math.max(320, body.clientWidth || 640);
    const height = 320;
    const margin = { top: 16, right: width < 520 ? 76 : 104, bottom: 56, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const maxX = Math.max(1, ...points.map((point) => point.x));
    const values = plotted.map((point) => point.mean);
    const baseMean = points[0] && points[0].item === baseline ? points[0].mean : null;
    const spread = noise && noise.null_difference_sd !== null && baseMean !== null ? noise.null_difference_sd : null;
    if (spread !== null) values.push(baseMean - 2 * spread, baseMean + 2 * spread);
    const bars = [];
    if (showBar) {
      for (const point of points) {
        if (point.item.role !== "candidate" || !point.parent || point.parent.mean === null) continue;
        const bar = keepBar(point);
        if (bar === null) continue;
        bars.push({ x: point.x, y: bar });
        values.push(bar);
      }
    }
    const low = Math.min(...values);
    const high = Math.max(...values);
    const unit = metricTypes.get(state.metric) === "boolean" || (low >= 0 && high <= 1);
    const pad = Math.max((high - low) * 0.12, 0.02);
    let scale = niceTicks(unit ? Math.max(0, low - pad) : low - pad, unit ? Math.min(1, high + pad) : high + pad);
    if (unit && (scale.low < 0 || scale.high > 1)) {
      scale = { ...scale, low: Math.max(0, scale.low), high: Math.min(1, scale.high) };
      scale.ticks = scale.ticks.filter((tick) => tick >= scale.low - 1e-9 && tick <= scale.high + 1e-9);
    }
    const xOf = (x) => margin.left + (maxX === 0 ? innerWidth / 2 : (x / maxX) * innerWidth);
    const yOf = (y) => margin.top + innerHeight - ((y - scale.low) / (scale.high - scale.low)) * innerHeight;
    const root = svg("svg", { width, height, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": state.metric + " " + state.stage + " mean per revision" });

    for (const tick of scale.ticks) {
      root.appendChild(svg("line", { class: "gridline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(tick), y2: yOf(tick) }));
      root.appendChild(svg("text", { x: margin.left - 8, y: yOf(tick) + 4, "text-anchor": "end", text: fmt(tick, scale.step < 0.01 ? 3 : 2) }));
    }
    root.appendChild(svg("line", { class: "axisline", x1: margin.left, x2: margin.left + innerWidth, y1: margin.top + innerHeight, y2: margin.top + innerHeight }));
    if (spread !== null) {
      const clampY = (y) => Math.min(margin.top + innerHeight, Math.max(margin.top, yOf(y)));
      root.appendChild(svg("rect", { class: "band-2", x: margin.left, width: innerWidth, y: clampY(baseMean + 2 * spread), height: clampY(baseMean - 2 * spread) - clampY(baseMean + 2 * spread) }));
      root.appendChild(svg("rect", { class: "band-1", x: margin.left, width: innerWidth, y: clampY(baseMean + spread), height: clampY(baseMean - spread) - clampY(baseMean + spread) }));
    }
    const labelled = thinLabels(points.map((point) => xOf(point.x)), 68);
    points.forEach((point, index) => {
      if (!labelled.has(index)) return;
      const label = svg("text", { x: xOf(point.x), y: margin.top + innerHeight + 18, "text-anchor": "middle", text: truncate(point.item.label, 14) });
      root.appendChild(label);
    });
    root.appendChild(svg("text", { x: margin.left + innerWidth / 2, y: height - 8, "text-anchor": "middle", text: "iteration (candidate registration order)" }));

    if (bars.length) {
      for (const bar of bars) {
        const half = Math.min(18, innerWidth / Math.max(2, maxX) / 2.5);
        root.appendChild(svg("path", { class: "threshold", d: "M" + (xOf(bar.x) - half) + "," + yOf(bar.y) + "H" + (xOf(bar.x) + half) }));
      }
    }
    for (const point of plotted) {
      if (point.item.kept || !point.parent || point.parent.mean === null) continue;
      root.appendChild(svg("line", { class: "branch", x1: xOf(point.parent.x), y1: yOf(point.parent.mean), x2: xOf(point.x), y2: yOf(point.mean) }));
    }
    const lineage = plotted.filter((point) => point.item.kept).sort((left, right) => left.x - right.x);
    if (lineage.length > 1) {
      root.appendChild(svg("path", { class: "lineage", d: lineage.map((point, index) => (index ? "L" : "M") + xOf(point.x) + "," + yOf(point.mean)).join("") }));
    }
    if (lineage.length) {
      const end = lineage[lineage.length - 1];
      const labelX = margin.left + innerWidth + 14;
      if (labelX - xOf(end.x) > 24) {
        root.appendChild(svg("line", { class: "leader", x1: xOf(end.x) + 8, y1: yOf(end.mean), x2: labelX - 4, y2: yOf(end.mean) }));
      }
      root.appendChild(svg("text", { class: "end-label", x: labelX, y: yOf(end.mean) + 4, text: "kept " + fmt(end.mean) }));
    }
    for (const point of points) {
      const rejected = point.mean === null;
      if (rejected && point.item.outcome !== "rejected") continue;
      const cx = xOf(point.x);
      const cy = rejected ? margin.top + innerHeight : yOf(point.mean);
      const outcome = point.item.outcome;
      if (rejected) {
        root.appendChild(svg("circle", { class: "dot rejected", cx, cy, r: 6 }));
        root.appendChild(svg("text", { x: cx, y: cy + 3.5, "text-anchor": "middle", class: "end-label", fill: "#ffffff", text: "✕" }));
      } else {
        root.appendChild(svg("circle", { class: "dot " + outcome, cx, cy, r: point.item.role === "candidate" ? 5 : 6 }));
      }
      const ring = svg("circle", { class: "focus-ring", cx, cy, r: 9 });
      const hit = svg("circle", {
        class: "hit",
        cx,
        cy,
        r: 13,
        tabindex: "0",
        role: "button",
        "aria-label": point.item.label + ", " + (OUTCOMES[outcome] || {}).label + ", mean " + fmt(point.mean),
      });
      hoverable(hit, () => scoreTooltip(point));
      hit.addEventListener("click", () => openRevision(point.item));
      hit.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRevision(point.item);
        }
      });
      root.appendChild(hit);
      root.appendChild(ring);
    }
    const present = new Set(points.map((point) => point.item.outcome));
    const items = [{ key: lineKey("bg-lineage"), label: "kept lineage" }, { key: lineKey("bg-branch"), label: "branch to parent" }];
    for (const outcome of ["keep", "revert", "undecided", "pending", "rejected"]) {
      if (present.has(outcome)) {
        items.push({ key: el("span", { class: "status-icon " + outcome, "aria-hidden": "true", text: OUTCOMES[outcome].icon }), label: OUTCOMES[outcome].label });
      }
    }
    if (spread !== null) items.push({ key: boxKey("band-legend"), label: "no-op band (±1, ±2 SD)" });
    if (bars.length) items.push({ key: el("span", { class: "key-dash", "aria-hidden": "true" }), label: "keep bar" });
    body.appendChild(legend(items));
    body.appendChild(root);
  }

  // ---------------------------------------------------------------- iterations table

  function iterationRows() {
    const rows = [];
    const seen = new Set();
    if (baseline) rows.push({ number: 0, item: baseline, iteration: null });
    if (iterations.length) {
      for (const iteration of iterations) {
        const item = iteration.candidate_id ? candidates.find((entry) => entry.key === iteration.candidate_id) : null;
        if (item) seen.add(item.key);
        rows.push({ number: iteration.number, item: item || null, iteration });
      }
    }
    for (const item of candidates) {
      if (!seen.has(item.key)) rows.push({ number: item.order, item, iteration: iterationByCandidate.get(item.key) || null });
    }
    return rows;
  }

  function rowOutcome(row) {
    if (row.item) return row.item.outcome;
    const status = row.iteration && row.iteration.status;
    if (status === "no_submission" || status === "rejected" || status === "undecided") return status;
    return "running";
  }

  function revisionTotals(revisionId) {
    const own = runs.filter((run) => run.revision_id === revisionId && (state.backend === "all" || run.backend_id === state.backend));
    return {
      tokens: sum(own.map((run) => (run.usage ? (run.usage.input_tokens || 0) + (run.usage.output_tokens || 0) : null))),
      seconds: sum(own.map((run) => run.duration_seconds)),
      scored: own.filter((run) => numeric(run.metrics[state.metric]) !== null).length,
      failures: own.filter((run) => run.agent_failure).length,
      runs: own.length,
    };
  }

  function stageDelta(item, stage) {
    if (!item || !item.parent_revision_id || item.status !== "admitted") return null;
    const own = stageMean(item.revision_id, stage, state.metric).mean;
    const parent = stageMean(item.parent_revision_id, stage, state.metric).mean;
    return own !== null && parent !== null ? own - parent : null;
  }

  const sortState = { index: 0, descending: false };

  // ---------------------------------------------------------------- canary

  // Share of scored runs whose output carries a feature, per candidate in the order the
  // coordinator wrote them; ``present`` picks the canary or one placebo control from a row.
  function canaryShares(rows, present) {
    const order = [];
    const groups = new Map();
    for (const row of rows) {
      if (!groups.has(row.candidate_id)) {
        groups.set(row.candidate_id, []);
        order.push(row.candidate_id);
      }
      groups.get(row.candidate_id).push(row);
    }
    return order.map((candidate) => {
      const group = groups.get(candidate);
      const scored = group.filter((row) => row.present !== null);
      const hits = scored.filter(present).length;
      return {
        candidate,
        runs: group.length,
        scored: scored.length,
        hits,
        share: scored.length ? hits / scored.length : null,
        bonus: sum(scored.map((row) => row.bonus || 0)),
      };
    });
  }

  function canaryControls(rows) {
    const names = [];
    for (const row of rows) {
      for (const item of row.controls || []) if (!names.includes(item.control_id)) names.push(item.control_id);
    }
    return names;
  }

  function controlPresent(name) {
    return (row) => Boolean((row.controls || []).find((item) => item.control_id === name && item.present));
  }

  function baselineRevisionId(snapshot) {
    const item = snapshot.revisions.find((rev) => rev.role === "baseline" || rev.role === "official_baseline");
    return item ? item.revision_id : null;
  }

  // The baseline's share of the shown canary over every Study on this page that starts from this
  // Study's baseline. A Study that rewarded another canary counts the shown one from its
  // controls, and its rows without that control are left out.
  function canaryBaseline(canaryId) {
    const own = baselineRevisionId(data);
    const pooled = [];
    let studies = 0;
    for (const segment of segments) {
      if (baselineRevisionId(segment.snapshot) !== own) continue;
      const rows = [];
      for (const row of segment.snapshot.canary || []) {
        if (row.candidate_id !== "baseline" || row.present === null) continue;
        if (row.canary_id === canaryId) rows.push(row.present);
        else {
          const control = (row.controls || []).find((item) => item.control_id === canaryId);
          if (control) rows.push(control.present);
        }
      }
      if (rows.length) studies += 1;
      pooled.push(...rows);
    }
    const hits = pooled.filter(Boolean).length;
    return { share: pooled.length ? hits / pooled.length : null, hits, scored: pooled.length, studies };
  }

  function renderCanary() {
    const rows = data.canary || [];
    byId("canary").hidden = byId("canary-link").hidden = !rows.length;
    if (!rows.length) return;
    const canaryIds = [...new Set(rows.map((row) => row.canary_id))];
    const base = canaryBaseline(canaryIds[0]);
    byId("canary-note").textContent =
      "Share of scored search and dev runs whose output carries the canary " + canaryIds.join(", ") +
      ", which the evaluator rewards with a small bonus, against placebo features it does not reward (grey)." +
      " The dashed line is the baseline's share" +
      (base.studies > 1 ? " pooled over " + base.studies + " Studies on this page" : " in this Study") +
      (base.scored ? " (" + base.hits + "/" + base.scored + " runs)." : "; no baseline run is scored yet.");
    const canary = canaryShares(rows, (row) => row.present === true);
    const controls = canaryControls(rows).map((name) => ({ name, shares: canaryShares(rows, controlPresent(name)) }));
    chartCard(
      byId("canary-card"),
      "canary share by iteration",
      "search + dev",
      (body) => drawCanary(body, canary, controls, base),
      (body) =>
        body.appendChild(
          table(
            [{ label: "Candidate" }, { label: "Scored runs", num: true }, { label: "Canary", num: true }, ...controls.map((item) => ({ label: item.name, num: true })), { label: "Bonus total", num: true }, { label: "Unscored", num: true }],
            canary.map((point, index) =>
              el(
                "tr",
                null,
                el("td", { text: point.candidate }),
                el("td", { class: "num", text: String(point.scored) }),
                el("td", { class: "num", text: point.scored ? point.hits + " (" + fmt(point.share, 2) + ")" : DASH }),
                ...controls.map((item) => {
                  const control = item.shares[index];
                  return el("td", { class: "num", text: control.scored ? control.hits + " (" + fmt(control.share, 2) + ")" : DASH });
                }),
                el("td", { class: "num", text: fmt(point.bonus, 2) }),
                el("td", { class: "num", text: String(point.runs - point.scored) })
              )
            )
          )
        )
    );
  }

  function drawCanary(body, canary, controls, base) {
    const width = Math.max(320, body.clientWidth || 640);
    const height = 260;
    const margin = { top: 16, right: controls.length ? 128 : 24, bottom: 40, left: 44 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const step = canary.length > 1 ? innerWidth / (canary.length - 1) : 0;
    const xOf = (index) => margin.left + (canary.length > 1 ? index * step : innerWidth / 2);
    const yOf = (share) => margin.top + innerHeight - share * innerHeight;
    const root = svg("svg", { width, height, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "canary share by iteration" });
    for (const tick of [0, 0.25, 0.5, 0.75, 1]) {
      root.appendChild(svg("line", { class: "gridline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(tick), y2: yOf(tick) }));
      root.appendChild(svg("text", { x: margin.left - 8, y: yOf(tick) + 4, "text-anchor": "end", text: fmt(tick, 2) }));
    }
    root.appendChild(svg("line", { class: "axisline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(0), y2: yOf(0) }));
    const shown = thinLabels(canary.map((_, index) => xOf(index)), 56);
    canary.forEach((point, index) => {
      if (shown.has(index)) root.appendChild(svg("text", { x: xOf(index), y: margin.top + innerHeight + 18, "text-anchor": "middle", text: truncate(point.candidate, 12) }));
    });
    if (base.share !== null) {
      root.appendChild(svg("line", { class: "threshold", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(base.share), y2: yOf(base.share) }));
    }
    const path = (points, cls) => {
      const segments = [];
      let current = [];
      points.forEach((point, index) => {
        if (point.share === null) {
          if (current.length) segments.push(current);
          current = [];
        } else current.push(xOf(index).toFixed(1) + "," + yOf(point.share).toFixed(1));
      });
      if (current.length) segments.push(current);
      for (const part of segments) root.appendChild(svg("polyline", { class: cls, points: part.join(" ") }));
    };
    for (const control of controls) path(control.shares, "canary-control");
    path(canary, "canary-line");
    // Name each line at its last point, pushed apart so close lines keep readable labels.
    const ends = [{ name: "canary", shares: canary }, ...controls]
      .map((line) => {
        const last = line.shares.map((point) => point.share).filter((share) => share !== null).pop();
        return last === undefined ? null : { name: line.name, y: yOf(last) };
      })
      .filter(Boolean)
      .sort((left, right) => left.y - right.y);
    ends.forEach((end, index) => {
      if (index && end.y - ends[index - 1].y < 12) end.y = ends[index - 1].y + 12;
    });
    for (const end of ends) {
      root.appendChild(svg("text", { class: "end-label", x: margin.left + innerWidth + 8, y: end.y + 4, text: truncate(end.name, 18) }));
    }
    canary.forEach((point, index) => {
      if (point.share === null) return;
      const cx = xOf(index);
      const cy = yOf(point.share);
      root.appendChild(svg("circle", { class: "dot canary", cx, cy, r: 5 }));
      const hit = svg("circle", { class: "hit", cx, cy, r: 12, tabindex: "0", role: "img", "aria-label": point.candidate + ", canary in " + point.hits + " of " + point.scored + " scored runs" });
      hoverable(hit, () => [
        tipLabel(point.candidate),
        tipValue("canary " + point.hits + "/" + point.scored + " (" + fmt(point.share, 2) + ")"),
        ...controls.map((control) => {
          const item = control.shares[index];
          return tipText(control.name + " " + item.hits + "/" + item.scored);
        }),
        tipText("bonus total " + fmt(point.bonus, 2) + (point.runs > point.scored ? "; " + (point.runs - point.scored) + " run(s) without a result" : "")),
        base.share !== null ? tipText("baseline " + fmt(base.share, 2)) : null,
      ].filter(Boolean));
      root.appendChild(hit);
    });
    const items = [{ key: lineKey("bg-canary"), label: "canary (rewarded)" }];
    if (controls.length) items.push({ key: lineKey("bg-control"), label: "placebo controls (" + controls.map((item) => item.name).join(", ") + ")" });
    if (base.share !== null) items.push({ key: el("span", { class: "key-dash", "aria-hidden": "true" }), label: "baseline share" });
    body.appendChild(legend(items));
    body.appendChild(root);
  }

  function renderIterations() {
    const container = clear(byId("iterations-table"));
    const rows = iterationRows().map((row) => {
      const item = row.item;
      const iteration = row.iteration;
      const totals = item ? revisionTotals(item.revision_id) : { tokens: null, seconds: null, scored: 0, failures: 0, runs: 0 };
      const sessions = iteration ? iteration.sessions : [];
      return {
        row,
        values: [
          row.number,
          item ? item.label : iteration ? iteration.candidate_id || "iter-" + String(iteration.number).padStart(3, "0") : DASH,
          item && item.parent_revision_id ? revisionLabel(item.parent_revision_id) : iteration && iteration.parent ? iteration.parent : DASH,
          rowOutcome(row),
          (item && item.hypothesis) || (iteration && iteration.hypothesis) || "",
          stageDelta(item, "search"),
          stageDelta(item, "dev"),
          item && item.decision ? decisionValue(item.decision) : null,
          totals.tokens,
          totals.seconds,
          item ? medianMinutes(item.revision_id, state.stage).minutes : null,
          ...costKeys.map((key) => (iteration && key in iteration.costs ? iteration.costs[key] : null)),
          sum(sessions.map((session) => session.total_cost_usd)),
          sum(sessions.map((session) => session.wall_seconds)),
          totals.runs ? totals.scored / totals.runs : null,
          totals.runs ? totals.failures / totals.runs : null,
        ],
        totals,
      };
    });
    const headers = [
      { label: "#", num: true },
      { label: "Candidate" },
      { label: "Parent" },
      { label: "Outcome" },
      { label: "Hypothesis" },
      { label: "Δ search " + state.metric, num: true, title: "Search mean minus the parent's search mean" },
      { label: "Δ dev " + state.metric, num: true, title: "Dev mean minus the parent's dev mean" },
      { label: "Dev decision", num: true, title: "Paired dev difference the frozen rule compared, and its bar" },
      { label: "Executor tokens", num: true },
      { label: "Run time (Σ)", num: true, title: "Sum of the revision's run durations" },
      { label: "Median run (" + state.stage + ")", num: true, title: "Median wall time of the revision's " + state.stage + " runs with a recorded duration" },
      ...costKeys.map((key) => ({ label: costUnit(key).label + " (" + costUnit(key).prefix + ")", num: true })),
      { label: "Meta Agent $", num: true, title: "Sum of the sessions' reported total_cost_usd" },
      { label: "Session time", num: true },
      { label: "Scored runs", num: true },
      { label: "Agent failures", num: true, title: "Runs that ended in an Agent-side failure (invalid artifact, timeout, protocol violation, unverified Harness), counted apart from the scores" },
    ];
    const { index, descending } = sortState;
    rows.sort((left, right) => {
      const a = left.values[index];
      const b = right.values[index];
      if (a === b) return left.values[0] - right.values[0];
      if (a === null || a === undefined || a === "") return 1;
      if (b === null || b === undefined || b === "") return -1;
      const order = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
      return descending ? -order : order;
    });
    const body = rows.map(({ row, values, totals }) => {
      const item = row.item;
      const decision = item && item.decision;
      const deltaCell = (value) => {
        const goodUp = rule && rule.metric === state.metric;
        const cls = goodUp && value !== null && Math.abs(value) > 1e-12 ? (value > 0 ? "num up" : "num down") : "num";
        return el("td", { class: cls, text: fmtSigned(value) });
      };
      const tr = el(
        "tr",
        {
          class: "clickable" + (item && item.kept ? " kept" : ""),
          tabindex: "0",
          on: {
            click: () => (item ? openRevision(item) : openIteration(row.iteration)),
            keydown: (event) => {
              if (event.key === "Enter") item ? openRevision(item) : openIteration(row.iteration);
            },
          },
        },
        el("td", { class: "num", text: String(values[0]) }),
        el("td", { class: "mono", text: values[1] }),
        el("td", { class: "mono", text: values[2] }),
        el("td", null, outcomeBadge(values[3])),
        el("td", { class: "hypothesis" }, el("div", { class: "clamp", title: values[4], text: values[4] || DASH })),
        deltaCell(values[5]),
        deltaCell(values[6]),
        el("td", { class: "num", title: decision ? decisionText(decision) : "", text: decision ? (decision.reason === "over_time_cap" ? "over time cap" : decision.reason === "more_failures" ? "more failures " + decision.candidate_failures + " vs " + decision.parent_failures : decision.reason === "more_flagged_runs" ? "more flagged runs " + decision.candidate_flagged + " vs " + decision.parent_flagged : fmtSigned(decisionValue(decision)) + " / ≥" + fmtSigned(barOf(decision)) + (isLogit(decision) ? " logit" : "")) + (decision.decided_by === "bounds" ? " · bounded, " + decision.missing_runs + " missing" : "") + (decision.excluded_pairs ? " · " + decision.excluded_pairs + " left out" : "") + (rule && rule.clean_run_metric !== null && decision.reason !== "more_flagged_runs" ? " · flagged " + decision.candidate_flagged + " vs " + decision.parent_flagged : "") : DASH }),
        el("td", { class: "num", text: fmtCompact(values[8]) }),
        el("td", { class: "num", text: fmtDuration(values[9]) }),
        el("td", { class: "num", text: values[10] === null ? DASH : fmt(values[10], 1) + " min" }),
        costKeys.map((key, offset) => el("td", { class: "num", text: fmtCost(key, values[11 + offset]) })),
        el("td", { class: "num", text: values[11 + costKeys.length] === null ? DASH : "$" + values[11 + costKeys.length].toFixed(2) }),
        el("td", { class: "num", text: fmtDuration(values[12 + costKeys.length]) }),
        el("td", { class: "num", text: totals.runs ? totals.scored + "/" + totals.runs : DASH }),
        el("td", { class: "num", text: totals.runs ? totals.failures + "/" + totals.runs : DASH })
      );
      return tr;
    });
    container.appendChild(
      table(headers, body, {
        sortable: true,
        sort: sortState,
        onSort: (column) => {
          if (sortState.index === column) sortState.descending = !sortState.descending;
          else {
            sortState.index = column;
            sortState.descending = false;
          }
          renderIterations();
        },
      })
    );
  }

  // ---------------------------------------------------------------- component timeline

  const CHANGE_GLYPH = { added: "+", modified: "~", removed: MINUS };

  function renderComponents() {
    const container = clear(byId("component-timeline"));
    const units = new Map();
    for (const item of candidates) {
      if (!item.delta) continue;
      for (const unit of item.delta.units) {
        if (!units.has(unit.unit_id)) units.set(unit.unit_id, { kind: unit.unit_kind, unit_id: unit.unit_id, first: item.order });
      }
    }
    if (!units.size) {
      container.appendChild(el("p", { class: "empty-state", text: "No admitted candidate has a component delta yet." }));
      return;
    }
    const columns = candidates;
    const head = el(
      "tr",
      null,
      el("th", { scope: "col", text: "Component" }),
      columns.map((item) =>
        el("th", { scope: "col", class: "num", title: item.hypothesis || "" }, el("div", { text: truncate(item.label, 12) }), outcomeBadge(item.outcome).firstChild)
      )
    );
    const rows = [...units.values()]
      .sort((left, right) => left.first - right.first || left.unit_id.localeCompare(right.unit_id))
      .map((unit) =>
        el(
          "tr",
          null,
          el("th", { scope: "row" }, el("span", { class: "kind", text: unit.kind }), el("span", { class: "mono", text: unit.unit_id })),
          columns.map((item) => {
            const change = item.delta ? item.delta.units.find((entry) => entry.unit_id === unit.unit_id) : null;
            if (!change) return el("td", { class: "cell" });
            const button = el("button", {
              type: "button",
              class: "mark " + item.outcome,
              text: CHANGE_GLYPH[change.change] || "?",
              "aria-label": unit.unit_id + " " + change.change + " in " + item.label + " (" + (OUTCOMES[item.outcome] || {}).label + ")",
              on: { click: () => openRevision(item, unit.unit_id) },
            });
            hoverable(button, () => [
              tipValue(change.change),
              tipLabel(unit.unit_id),
              el("div", { class: "tt-row" }, outcomeBadge(item.outcome), el("span", { class: "tt-label", text: item.label })),
              item.hypothesis ? tipText(truncate(item.hypothesis, 200)) : null,
            ]);
            return el("td", { class: "cell" }, button);
          })
        )
      );
    container.appendChild(el("table", { class: "timeline" }, el("thead", null, head), el("tbody", null, rows)));
    container.appendChild(
      legend([
        { key: el("span", { class: "mono", text: "+" }), label: "added" },
        { key: el("span", { class: "mono", text: "~" }), label: "modified" },
        { key: el("span", { class: "mono", text: MINUS }), label: "removed" },
      ])
    );
  }

  // ---------------------------------------------------------------- heatmaps

  function rampClass(value, low, high) {
    if (value === null) return "missing";
    const t = high === low ? 1 : (value - low) / (high - low);
    const step = Math.max(0, Math.min(6, Math.round(t * 6)));
    return "s" + step;
  }

  function cellRuns(revisionId, taskId, stage) {
    return runsFor(revisionId, stage)
      .filter((run) => run.task_id === taskId)
      .sort((left, right) => left.repeat_index - right.repeat_index || left.backend_id.localeCompare(right.backend_id));
  }

  function renderHeatChips() {
    const container = clear(byId("heat-metrics"));
    for (const item of study.metrics) {
      const pressed = state.heat.includes(item.name);
      container.appendChild(
        el("button", {
          type: "button",
          class: "chip",
          "aria-pressed": pressed ? "true" : "false",
          text: item.name,
          on: {
            click: () => {
              state.heat = pressed ? state.heat.filter((name) => name !== item.name) : [...state.heat, item.name];
              store.set("heat", state.heat);
              renderHeatChips();
              renderHeatmaps();
            },
          },
        })
      );
    }
  }

  function renderHeatmaps() {
    const container = clear(byId("heatmaps"));
    const stage = state.stage;
    const tasks = data.tasks.filter((task) => task.stage === stage);
    const columns = columnsFor(stage);
    byId("tasks-note").textContent =
      "Rows are " + stage + " tasks and columns the revisions that ran them; a cell is the mean over its repeats" +
      (state.backend === "all" ? " and backends" : " on " + state.backend) +
      ". Pick metrics below to compare them side by side.";
    if (!tasks.length || !columns.length) {
      container.appendChild(el("p", { class: "empty-state", text: "No " + stage + " runs yet." }));
      return;
    }
    const chosen = study.metrics.filter((item) => state.heat.includes(item.name));
    if (!chosen.length) {
      container.appendChild(el("p", { class: "empty-state", text: "Select at least one metric." }));
      return;
    }
    for (const metric of chosen) {
      const cells = tasks.map((task) =>
        columns.map((item) => {
          const own = cellRuns(item.revision_id, task.task_id, stage);
          return { task, item, own, value: mean(own.map((run) => numeric(run.metrics[metric.name]))) };
        })
      );
      const values = cells.flat().map((cell) => cell.value).filter((value) => value !== null);
      let low = Math.min(...values);
      let high = Math.max(...values);
      if (metric.value_type === "boolean" || (values.length && low >= 0 && high <= 1)) {
        low = 0;
        high = 1;
      }
      const block = el("div", { class: "card scroll-x heatmap-block" });
      block.appendChild(
        el("div", { class: "card-head" }, el("h3", { text: metric.name + (metric.value_type === "boolean" ? " (pass rate)" : "") }), el("span", { class: "subtle", text: stage }))
      );
      const head = el("tr", null, el("th", { scope: "col" }), columns.map((item) => el("th", { scope: "col", title: item.hypothesis || item.label, text: truncate(item.label, 10) })));
      const rows = cells.map((row) =>
        el(
          "tr",
          null,
          el("th", { scope: "row", class: "row", title: row[0].task.task_id, text: row[0].task.task_id }),
          row.map((cell) => {
            const td = el("td", {
              class: rampClass(cell.value, low, high),
              tabindex: "0",
              text: cell.value === null ? DASH : fmt(cell.value, 2),
              "aria-label": cell.task.task_id + " " + cell.item.label + " " + fmt(cell.value),
            });
            hoverable(td, () => [
              tipValue(fmt(cell.value)),
              tipLabel(cell.task.task_id + " × " + cell.item.label),
              cell.own.map((run) => {
                const value = run.metrics[metric.name];
                const reason = run.unavailable[metric.name];
                return tipLabel(
                  "r" + run.repeat_index + (study.backends.length > 1 ? " " + run.backend_id : "") + ": " +
                    (value === null || value === undefined ? reason || "no value" : fmt(value) + assignedNote(run, metric.name))
                );
              }),
            ]);
            td.addEventListener("click", () => openRevision(cell.item));
            return td;
          })
        )
      );
      block.appendChild(el("table", { class: "heat" }, el("thead", null, head), el("tbody", null, rows)));
      block.appendChild(
        el(
          "div",
          { class: "scale" },
          el("span", { text: fmt(low, 2) }),
          el("span", { class: "scale-bar", "aria-hidden": "true" }, [0, 1, 2, 3, 4, 5, 6].map((step) => el("span", { class: "s" + step }))),
          el("span", { text: fmt(high, 2) }),
          el("span", { class: "heat-missing-key", text: "  " + DASH + " no value" })
        )
      );
      container.appendChild(block);
    }
  }

  // ---------------------------------------------------------------- traces

  const LATENCY = [
    { key: "model_ms", label: "model", cls: "model" },
    { key: "tool_ms", label: "tool", cls: "tool" },
    { key: "hook_ms", label: "hook", cls: "hook" },
    { key: "background_ms", label: "background", cls: "background" },
    { key: "other_ms", label: "other", cls: "other" },
  ];

  function tracedRuns(revisionId, stage) {
    return runsFor(revisionId, stage).filter((run) => run.trace);
  }

  // One shape for both trace views. Claude Code splits wall time by what was running; Pi's
  // learning trace gives model time only, so the rest of a Pi run's wall time is "other". A Pi
  // component row counts the model calls an extension made plus its Harness interventions.
  const TRACE_VIEWS = new WeakMap();

  function traceOf(run) {
    const t = run.trace;
    if (!t) return null;
    if (TRACE_VIEWS.has(t)) return TRACE_VIEWS.get(t);
    let view;
    if (t.backend !== "pi") {
      view = {
        backend: "claude-code",
        status: t.status,
        wall_ms: t.wall_ms,
        turns: t.turns.total,
        tool_total: t.tool_calls.total,
        tool_errors: t.tool_calls.errors,
        latency: t.latency || null,
        components: t.components.map((row) => ({ key: row.kind + ":" + row.name, count: row.invocations, ms: row.total_ms, errors: row.errors, installed: row.installed, observation: row.observation })),
        tools: t.tools.map((row) => ({ key: row.name, count: row.calls, ms: row.total_ms, errors: row.errors, installed: true, observation: "invoked" })),
        harness_scope: null,
      };
    } else {
      const tools = t.tools || [];
      const components = new Map();
      const component = (name, installed) => {
        if (!components.has(name)) components.set(name, { key: "pi:" + name, count: 0, ms: 0, errors: 0, installed, observation: "loaded" });
        return components.get(name);
      };
      for (const name of t.components || []) component(name, true);
      for (const [name, count] of Object.entries(t.by_component || {})) {
        const row = component(name, false);
        row.count += count;
        row.observation = "invoked";
      }
      for (const item of t.interventions || []) {
        const row = component(item.component, false);
        row.count += item.count;
        row.observation = "invoked";
      }
      const wall = (t.wall_seconds || 0) * 1000;
      const model = Math.min(wall, (t.model_seconds || 0) * 1000);
      view = {
        backend: "pi",
        status: t.status,
        wall_ms: wall,
        turns: t.model_calls,
        tool_total: tools.reduce((total, row) => total + (row.calls || 0), 0),
        tool_errors: tools.reduce((total, row) => total + (row.errors || 0), 0),
        latency: { model_ms: model, tool_ms: 0, hook_ms: 0, background_ms: 0, other_ms: wall - model },
        components: [...components.values()],
        tools: tools.map((row) => ({ key: row.name, count: row.calls, ms: (row.seconds || 0) * 1000, errors: row.errors, installed: true, observation: "invoked" })),
        harness_scope: t.harness_scope || null,
      };
    }
    TRACE_VIEWS.set(t, view);
    return view;
  }

  function renderTraces() {
    const stage = state.stage;
    const columns = columnsFor(stage).filter((item) => tracedRuns(item.revision_id, stage).length);
    const traced = runs.filter((run) => run.trace).length;
    byId("traces-note").textContent =
      traced + " of " + runs.length + " runs have a trace (Claude Code, or a Pi learning trace). Values are means per traced " + stage +
      " run; Claude Code tokens come from each run's result report and Pi tokens from its trace. A Pi trace records model time only, so the rest of a Pi run's wall time shows as other.";
    const latencyCard = byId("latency-card");
    const traceTable = clear(byId("trace-table"));
    const componentCard = clear(byId("component-calls"));
    const toolCard = clear(byId("tool-calls"));
    if (!columns.length) {
      clear(latencyCard).appendChild(el("p", { class: "empty-state", text: "No traced " + stage + " runs." }));
      return;
    }
    const split = columns.map((item) => {
      const own = tracedRuns(item.revision_id, stage);
      const parts = {};
      for (const part of LATENCY) parts[part.key] = mean(own.map((run) => (traceOf(run).latency ? traceOf(run).latency[part.key] : null))) || 0;
      return { item, own, parts, total: LATENCY.reduce((total, part) => total + parts[part.key], 0) };
    });
    chartCard(
      latencyCard,
      "Wall time per run, by what was running",
      stage + " · minutes",
      (body) => drawLatency(body, split),
      (body) =>
        body.appendChild(
          table(
            [{ label: "Revision" }, ...LATENCY.map((part) => ({ label: part.label + " (min)", num: true })), { label: "total (min)", num: true }],
            split.map((column) =>
              el(
                "tr",
                null,
                el("td", { text: column.item.label }),
                LATENCY.map((part) => el("td", { class: "num", text: fmt(column.parts[part.key] / 60000, 2) })),
                el("td", { class: "num", text: fmt(column.total / 60000, 2) })
              )
            )
          )
        )
    );

    traceTable.appendChild(el("div", { class: "card-head" }, el("h3", { text: "Per-run means" }), el("span", { class: "subtle", text: stage })));
    traceTable.appendChild(
      table(
        [
          { label: "Revision" },
          { label: "Traced runs", num: true },
          { label: "Wall", num: true },
          { label: "Turns", num: true },
          { label: "Tool calls", num: true },
          { label: "Tool errors", num: true },
          { label: "Input tokens", num: true },
          { label: "Cached input", num: true },
          { label: "Output tokens", num: true },
          { label: "Incomplete traces", num: true },
        ],
        split.map(({ item, own }) => {
          const usage = runsFor(item.revision_id, stage).map((run) => run.usage).filter(Boolean);
          const input = mean(usage.map((entry) => entry.input_tokens));
          const cached = mean(usage.map((entry) => entry.cache_read_input_tokens));
          return el(
            "tr",
            { class: "clickable", on: { click: () => openRevision(item) } },
            el("td", { text: item.label }),
            el("td", { class: "num", text: String(own.length) }),
            el("td", { class: "num", text: fmtDuration(mean(own.map((run) => traceOf(run).wall_ms / 1000))) }),
            el("td", { class: "num", text: fmt(mean(own.map((run) => traceOf(run).turns)), 1) }),
            el("td", { class: "num", text: fmt(mean(own.map((run) => traceOf(run).tool_total)), 1) }),
            el("td", { class: "num", text: fmt(mean(own.map((run) => traceOf(run).tool_errors)), 1) }),
            el("td", { class: "num", text: fmtCompact(input) }),
            el("td", { class: "num", text: input ? Math.round((100 * (cached || 0)) / input) + "%" : DASH }),
            el("td", { class: "num", text: fmtCompact(mean(usage.map((entry) => entry.output_tokens))) }),
            el("td", { class: "num", text: String(own.filter((run) => traceOf(run).status !== "complete").length) })
          );
        })
      )
    );

    heatTable(
      componentCard,
      "Component invocations per run",
      "Bundle components and components seen outside it. loaded: in the session but never invoked; not seen: installed but absent from the trace; n/o: not observable (instructions); " + DASH + ": not installed.",
      split,
      (run) => traceOf(run).components,
      true
    );
    heatTable(
      toolCard,
      "Tool calls per run",
      "Every tool the Agent called, including MCP tools.",
      split,
      (run) => traceOf(run).tools,
      false
    );
  }

  function heatTable(container, title, note, split, rowsOf, installedMatters) {
    container.appendChild(el("div", { class: "card-head" }, el("h3", { text: title }), el("span", { class: "subtle", text: note })));
    const keys = new Map();
    const perColumn = split.map(({ item, own }) => {
      const totals = new Map();
      for (const run of own) {
        for (const row of rowsOf(run)) {
          if (!keys.has(row.key)) keys.set(row.key, row.key);
          const entry = totals.get(row.key) || { count: 0, ms: 0, errors: 0, installed: false, observed: {} };
          entry.count += row.count;
          entry.ms += row.ms;
          entry.errors += row.errors;
          entry.installed = entry.installed || row.installed;
          entry.observed[row.observation] = (entry.observed[row.observation] || 0) + 1;
          totals.set(row.key, entry);
        }
      }
      return { item, runs: own.length, totals };
    });
    if (!keys.size) {
      container.appendChild(el("p", { class: "empty-state", text: "Nothing recorded." }));
      return;
    }
    let high = 0;
    for (const column of perColumn) for (const entry of column.totals.values()) high = Math.max(high, entry.count / Math.max(1, column.runs));
    const head = el("tr", null, el("th", { scope: "col" }), perColumn.map((column) => el("th", { scope: "col", text: truncate(column.item.label, 10), title: column.item.label })));
    const rows = [...keys.keys()].sort().map((key) =>
      el(
        "tr",
        null,
        el("th", { scope: "row", class: "row mono", title: key, text: key }),
        perColumn.map((column) => {
          const entry = column.totals.get(key);
          if (!entry || (installedMatters && !entry.installed && entry.count === 0)) {
            return el("td", { class: "missing", text: DASH, title: "not installed" });
          }
          const value = entry.count / Math.max(1, column.runs);
          let td;
          if (entry.count > 0 || !installedMatters) {
            td = el("td", { class: rampClass(value, 0, high || 1), tabindex: "0", text: fmt(value, value >= 10 ? 0 : 1) });
          } else {
            const seen = entry.observed;
            const word = seen.loaded_only ? "loaded" : seen.not_seen ? "not seen" : "n/o";
            td = el("td", { class: "missing state", tabindex: "0", text: word });
          }
          hoverable(td, () => [
            tipValue(fmt(value, 2) + " per run"),
            tipLabel(key + " · " + column.item.label),
            tipLabel(entry.count + " calls in " + column.runs + " runs · " + fmtDuration(entry.ms / 1000) + " total"),
            entry.errors ? tipLabel(entry.errors + " errors") : null,
            installedMatters ? tipLabel(entry.installed ? "installed by the bundle" : "observed outside the bundle") : null,
            installedMatters
              ? tipLabel(
                  Object.entries(entry.observed)
                    .map(([name, count]) => count + " " + name.replace(/_/g, " "))
                    .join(" · ") + " (runs)"
                )
              : null,
          ]);
          return td;
        })
      )
    );
    container.appendChild(el("table", { class: "heat" }, el("thead", null, head), el("tbody", null, rows)));
  }

  function drawLatency(body, split) {
    const width = Math.max(320, body.clientWidth || 640);
    const height = 280;
    const margin = { top: 12, right: 96, bottom: 44, left: 52 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const highest = Math.max(...split.map((column) => column.total / 60000), 0.001);
    const scale = niceTicks(0, highest);
    const yOf = (minutes) => margin.top + innerHeight - (minutes / scale.high) * innerHeight;
    const band = innerWidth / split.length;
    const barWidth = Math.min(24, band * 0.6);
    const root = svg("svg", { width, height, viewBox: "0 0 " + width + " " + height, role: "img", "aria-label": "Wall time split per revision" });
    for (const tick of scale.ticks) {
      root.appendChild(svg("line", { class: "gridline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(tick), y2: yOf(tick) }));
      root.appendChild(svg("text", { x: margin.left - 8, y: yOf(tick) + 4, "text-anchor": "end", text: fmt(tick, scale.step < 1 ? 1 : 0) }));
    }
    root.appendChild(svg("line", { class: "axisline", x1: margin.left, x2: margin.left + innerWidth, y1: yOf(0), y2: yOf(0) }));
    const labelled = thinLabels(split.map((column, index) => margin.left + band * index + band / 2), 68);
    split.forEach((column, index) => {
      const x = margin.left + band * index + band / 2;
      if (labelled.has(index)) {
        root.appendChild(svg("text", { x, y: margin.top + innerHeight + 18, "text-anchor": "middle", text: truncate(column.item.label, 12) }));
      }
      let top = yOf(0);
      LATENCY.forEach((part) => {
        const minutes = column.parts[part.key] / 60000;
        if (minutes <= 0) return;
        const segment = Math.max(0, yOf(0) - yOf(minutes) - 2);
        if (segment <= 0) return;
        const y = top - segment;
        const rect = svg("rect", { class: "seg-" + part.cls, x: x - barWidth / 2, y, width: barWidth, height: segment, rx: 2, tabindex: "0" });
        hoverable(rect, () => [
          tipValue(fmt(minutes, 2) + " min"),
          el("div", { class: "tt-row" }, lineKey("bg-" + part.cls), el("span", { class: "tt-label", text: part.label })),
          tipLabel(column.item.label + " · total " + fmt(column.total / 60000, 2) + " min per run"),
        ]);
        root.appendChild(rect);
        top = y - 2;
      });
      if (index === split.length - 1) {
        root.appendChild(svg("text", { class: "end-label", x: x + barWidth / 2 + 8, y: yOf(column.total / 60000) + 4, text: fmt(column.total / 60000, 1) + " min" }));
      }
    });
    root.appendChild(svg("text", { x: 14, y: margin.top + innerHeight / 2, transform: "rotate(-90 14 " + (margin.top + innerHeight / 2) + ")", "text-anchor": "middle", text: "minutes per run" }));
    body.appendChild(legend(LATENCY.map((part) => ({ key: boxKey("bg-" + part.cls), label: part.label }))));
    body.appendChild(root);
  }

  // ---------------------------------------------------------------- gallery

  function renderGallery() {
    const container = clear(byId("gallery-grid"));
    const stage = state.stage;
    const tasks = data.tasks.filter((task) => task.stage === stage);
    const columns = columnsFor(stage);
    const shots = runs.filter((run) => run.screenshot).length;
    byId("gallery-note").textContent =
      shots + " of " + runs.length + " runs have a screenshot" +
      (shots ? "" : "; export with --screenshots to render HTML outputs") +
      ". Each cell shows the first repeat with an image; click to enlarge.";
    if (!tasks.length || !columns.length) {
      container.appendChild(el("p", { class: "empty-state", text: "No " + stage + " runs yet." }));
      return;
    }
    const head = el("tr", null, el("th", { scope: "col" }), columns.map((item) => el("th", { scope: "col", title: item.label }, el("span", null, truncate(item.label, 24)), " ", outcomeBadge(item.outcome).firstChild)));
    const rows = tasks.map((task) =>
      el(
        "tr",
        null,
        el("th", { scope: "row", class: "row mono", title: task.task_id, text: task.task_id }),
        columns.map((item) => {
          const own = cellRuns(item.revision_id, task.task_id, stage);
          if (!own.length) return el("td", null, el("div", { class: "shot" }, el("span", { class: "shot-empty", text: "not run" })));
          const run = own.find((entry) => entry.screenshot) || own[0];
          const value = run.metrics[state.metric];
          const caption = "r" + run.repeat_index + " · " + state.metric + " " + fmt(value === undefined ? null : value) + (own.length > 1 ? " · +" + (own.length - 1) + " more" : "");
          const reason = run.screenshot
            ? null
            : run.classification || (run.attempt_status !== "verified_result" ? run.attempt_status : null) || (run.artifacts.length ? "not rendered" : "no artifact");
          const button = el(
            "button",
            { type: "button", class: "shot", "aria-label": task.task_id + " " + item.label + " " + caption },
            run.screenshot ? el("img", { src: run.screenshot, alt: task.task_id + " output of " + item.label, loading: "lazy" }) : el("span", { class: "shot-empty", text: reason || "no screenshot" }),
            el("span", { class: "shot-caption", text: caption })
          );
          button.addEventListener("click", () => (run.screenshot ? openLightbox(run, item) : openRevision(item)));
          return el("td", null, button);
        })
      )
    );
    container.appendChild(el("table", { class: "gallery" }, el("thead", null, head), el("tbody", null, rows)));
  }

  const viewer = { columns: [], column: 0, taskId: null, repeat: 0, stage: null };

  function viewerRuns() {
    const item = viewer.columns[viewer.column];
    return item ? cellRuns(item.revision_id, viewer.taskId, viewer.stage) : [];
  }

  function showViewer() {
    const item = viewer.columns[viewer.column];
    const own = viewerRuns();
    const run = own.find((entry) => entry.repeat_index === viewer.repeat) || own.find((entry) => entry.screenshot) || own[0];
    if (run) viewer.repeat = run.repeat_index;
    const image = byId("lightbox-image");
    const empty = byId("lightbox-empty");
    if (run && run.screenshot) {
      image.hidden = false;
      empty.hidden = true;
      image.src = run.screenshot;
      image.alt = viewer.taskId + " output of " + item.label;
    } else {
      image.hidden = true;
      image.removeAttribute("src");
      empty.hidden = false;
      empty.textContent = run
        ? "No screenshot: " + (run.classification || run.attempt_status || (run.artifacts.length ? "not rendered" : "no artifact"))
        : "Not run";
    }
    byId("lightbox-position").textContent =
      item.label + " · " + (OUTCOMES[item.outcome] || {}).label + " (" + (viewer.column + 1) + " of " + viewer.columns.length + ")";
    byId("lightbox-prev").disabled = viewer.column === 0;
    byId("lightbox-next").disabled = viewer.column === viewer.columns.length - 1;
    const repeats = clear(byId("lightbox-repeats"));
    for (const entry of own) {
      repeats.appendChild(
        el("button", {
          type: "button",
          class: "ghost",
          "aria-pressed": entry === run ? "true" : "false",
          text: "r" + entry.repeat_index + (study.backends.length > 1 ? " " + entry.backend_id : ""),
          on: {
            click: () => {
              viewer.repeat = entry.repeat_index;
              showViewer();
            },
          },
        })
      );
    }
    const metrics = run
      ? study.metrics
          .filter((metric) => run.metrics[metric.name] !== null && run.metrics[metric.name] !== undefined)
          .slice(0, 8)
          .map((metric) => metric.name + " " + fmt(run.metrics[metric.name]))
          .join(" · ")
      : "";
    byId("lightbox-caption").textContent =
      viewer.taskId + (run ? " · repeat " + run.repeat_index : "") + (metrics ? " · " + metrics : "") +
      " · ←/→ revisions, ↑/↓ repeats";
  }

  function openLightbox(run, item) {
    viewer.stage = run.stage;
    viewer.columns = columnsFor(run.stage);
    viewer.column = Math.max(0, viewer.columns.indexOf(item));
    viewer.taskId = run.task_id;
    viewer.repeat = run.repeat_index;
    lastFocus = document.activeElement;
    byId("lightbox").hidden = false;
    showViewer();
    byId("lightbox-close").focus();
  }

  function stepViewer(columns, repeats) {
    if (columns) {
      viewer.column = Math.max(0, Math.min(viewer.columns.length - 1, viewer.column + columns));
    }
    if (repeats) {
      const own = viewerRuns().map((entry) => entry.repeat_index);
      const at = own.indexOf(viewer.repeat);
      if (own.length) viewer.repeat = own[Math.max(0, Math.min(own.length - 1, (at < 0 ? 0 : at) + repeats))];
    }
    showViewer();
  }

  function closeLightbox() {
    byId("lightbox").hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ---------------------------------------------------------------- reasoning log

  function sessionFacts(sessions) {
    const parts = [sessions.length + (sessions.length === 1 ? " session" : " sessions")];
    const wall = sum(sessions.map((session) => session.wall_seconds));
    if (wall !== null) parts.push(fmtDuration(wall));
    const turns = sum(sessions.map((session) => session.num_turns));
    if (turns !== null) parts.push(turns + " turns");
    const cost = sum(sessions.map((session) => session.total_cost_usd));
    if (cost !== null) parts.push("$" + cost.toFixed(2) + " reported");
    if (sessions.some((session) => session.timed_out)) parts.push("timed out");
    return parts.join(" · ");
  }

  function messageList(session) {
    return el(
      "ul",
      { class: "messages" },
      session.messages.map((message) =>
        el("li", { class: message.kind }, el("span", { class: "who", text: message.kind }), message.text)
      ),
      session.messages_truncated ? el("li", { class: "thinking", text: "Further messages are left out of the snapshot." }) : null
    );
  }

  function iterationCard(iteration) {
    const item = iteration.candidate_id ? candidates.find((entry) => entry.key === iteration.candidate_id) : null;
    const outcome = item ? item.outcome : rowOutcome({ item: null, iteration });
    const card = el("article", { class: "iteration-card" });
    card.appendChild(
      el(
        "header",
        null,
        el("h3", { text: iteration.candidate_id || "iter-" + String(iteration.number).padStart(3, "0") }),
        outcomeBadge(outcome),
        iteration.parent ? el("span", { class: "facts", text: "parent " + iteration.parent }) : null,
        iteration.sessions.length ? el("span", { class: "facts", text: sessionFacts(iteration.sessions) }) : null,
        item ? el("button", { type: "button", class: "ghost", text: "Details", on: { click: () => openRevision(item) } }) : null
      )
    );
    const hypothesis = iteration.hypothesis || (item && item.hypothesis);
    if (hypothesis) card.appendChild(el("p", { class: "prose" }, el("strong", { text: "Hypothesis. " }), hypothesis));
    if (iteration.failure_code) card.appendChild(el("p", { class: "facts", text: "failure: " + iteration.failure_code }));
    if (iteration.unscored_dev_runs.length) card.appendChild(el("p", { class: "facts", text: "unscored dev runs: " + iteration.unscored_dev_runs.join("; ") }));
    if (iteration.notes_added) {
      const first = iteration.notes_added === iteration.notes;
      card.appendChild(el("div", { class: "subtle", text: first ? "Notes" : "Notes added this iteration" }));
      card.appendChild(el("div", { class: "prose", text: iteration.notes_added }));
    }
    if (iteration.notes && iteration.notes !== iteration.notes_added) {
      card.appendChild(el("details", null, el("summary", { text: "Full notebook" + (iteration.notes_truncated ? " (truncated)" : "") }), el("div", { class: "prose", text: iteration.notes })));
    }
    for (const session of iteration.sessions) {
      if (!session.messages.length) continue;
      card.appendChild(
        el(
          "details",
          null,
          el("summary", { text: "Session " + session.index + " · " + session.messages.length + " messages" + (session.wall_seconds !== null ? " · " + fmtDuration(session.wall_seconds) : "") }),
          messageList(session)
        )
      );
    }
    return card;
  }

  function renderReasoning() {
    const container = clear(byId("reasoning-log"));
    if (!iterations.length) {
      byId("reasoning-note").textContent =
        "Hypotheses from the Study ledger. Export with --iterations to add the coordinator's notes and Meta Agent sessions.";
      if (!candidates.length) {
        container.appendChild(el("p", { class: "empty-state", text: "No candidate registered yet." }));
        return;
      }
      for (const item of candidates.slice().reverse()) {
        container.appendChild(
          el(
            "article",
            { class: "iteration-card" },
            el("header", null, el("h3", { text: item.label }), outcomeBadge(item.outcome), el("button", { type: "button", class: "ghost", text: "Details", on: { click: () => openRevision(item) } })),
            el("p", { class: "prose", text: item.hypothesis || "" })
          )
        );
      }
      return;
    }
    byId("reasoning-note").textContent = "Newest first: hypotheses, the notebook lines each iteration added, and the Meta Agent's own messages.";
    for (const iteration of iterations.slice().reverse()) container.appendChild(iterationCard(iteration));
  }

  // ---------------------------------------------------------------- drawer

  const drawer = byId("drawer");
  let lastFocus = null;

  function openDrawer(title, nodes) {
    lastFocus = document.activeElement;
    byId("drawer-title").textContent = title;
    appendChildren(clear(byId("drawer-body")), nodes);
    drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false");
    drawer.scrollTop = 0;
    byId("drawer-close").focus();
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    drawer.setAttribute("aria-hidden", "true");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function diffBlock(file) {
    if (file.diff === null) {
      return el("p", { class: "subtle", text: file.binary ? "binary content" : "content unavailable" });
    }
    const block = el("div", { class: "diff", role: "region", "aria-label": "diff of " + file.path });
    for (const line of file.diff.split("\n")) {
      let cls = null;
      if (line.startsWith("@@")) cls = "hunk";
      else if (line.startsWith("+++") || line.startsWith("---")) cls = "hunk";
      else if (line.startsWith("+")) cls = "add";
      else if (line.startsWith("-")) cls = "del";
      block.appendChild(el("div", { class: cls, text: line }));
    }
    if (file.truncated) block.appendChild(el("div", { class: "hunk", text: "… diff truncated" }));
    return block;
  }

  function scoresTable(item) {
    const stagesHere = STAGE_ORDER.filter((stage) => runs.some((run) => run.revision_id === item.revision_id && run.stage === stage));
    if (!stagesHere.length) return el("p", { class: "subtle", text: "No runs registered for this revision." });
    const valued = study.metrics.filter((metric) =>
      stagesHere.some((stage) => stageMean(item.revision_id, stage, metric.name).scored > 0)
    );
    const empty = study.metrics.filter((metric) => !valued.includes(metric));
    const rows = valued.map((metric) =>
      el(
        "tr",
        null,
        el("td", { class: "mono", text: metric.name }),
        stagesHere.map((stage) => {
          const own = stageMean(item.revision_id, stage, metric.name);
          const parent = item.parent_revision_id ? stageMean(item.parent_revision_id, stage, metric.name).mean : null;
          const delta = own.mean !== null && parent !== null ? own.mean - parent : null;
          return [
            el("td", { class: "num", text: fmt(own.mean) + " (" + own.scored + "/" + own.runs + ")" }),
            el("td", { class: "num", text: item.parent_revision_id ? fmtSigned(delta) : DASH }),
          ];
        })
      )
    );
    return el(
      "div",
      { class: "scroll-x" },
      valued.length
        ? table([{ label: "Metric" }, ...stagesHere.flatMap((stage) => [{ label: stage + " mean (scored/runs)", num: true }, { label: "Δ parent", num: true }])], rows)
        : null,
      empty.length ? el("p", { class: "subtle", text: "No value in any run: " + empty.map((metric) => metric.name).join(", ") }) : null
    );
  }

  function runsTable(item) {
    const own = runs
      .filter((run) => run.revision_id === item.revision_id)
      .sort((left, right) => STAGE_ORDER.indexOf(left.stage) - STAGE_ORDER.indexOf(right.stage) || left.task_id.localeCompare(right.task_id) || left.repeat_index - right.repeat_index);
    if (!own.length) return el("p", { class: "subtle", text: "No runs." });
    return el(
      "div",
      { class: "scroll-x" },
      table(
        [
          { label: "Stage" },
          { label: "Task" },
          { label: "Rep", num: true },
          { label: "Status" },
          { label: state.metric, num: true },
          { label: "Time", num: true },
          { label: "Tokens", num: true },
          { label: "Turns", num: true },
          { label: "Tool calls", num: true },
          { label: "Released" },
        ],
        own.map((run) => {
          const value = run.metrics[state.metric];
          const status = runState(run);
          return el(
            "tr",
            null,
            el("td", { text: run.stage }),
            el("td", { class: "mono", text: run.task_id + (study.backends.length > 1 ? " · " + run.backend_id : "") }),
            el("td", { class: "num", text: String(run.repeat_index) }),
            el("td", { text: status + (run.evaluation_failure_code ? " · " + run.evaluation_failure_code : ""), title: run.trace_unavailable || "" }),
            el("td", { class: "num", text: value === null || value === undefined ? run.unavailable[state.metric] || DASH : fmt(value) + assignedNote(run, state.metric) }),
            el("td", { class: "num", text: fmtDuration(run.duration_seconds) }),
            el("td", { class: "num", text: run.usage ? fmtCompact((run.usage.input_tokens || 0) + (run.usage.output_tokens || 0)) : DASH }),
            el("td", { class: "num", text: run.trace ? String(traceOf(run).turns) : DASH }),
            el("td", { class: "num", text: run.trace ? traceOf(run).tool_total + (traceOf(run).tool_errors ? " (" + traceOf(run).tool_errors + " err)" : "") : DASH }),
            el("td", { text: run.released ? "yes" + releasedSummary(run).text : "", title: releasedSummary(run).title })
          );
        })
      )
    );
  }

  function openRevision(item, focusUnit) {
    const nodes = [];
    const facts = [
      ["Outcome", outcomeBadge(item.outcome)],
      ["Revision", el("span", { class: "mono", title: item.revision_id, text: item.revision_id })],
      ["Parent", item.parent_revision_id ? revisionLabel(item.parent_revision_id) + " (" + shortId(item.parent_revision_id) + ")" : DASH],
    ];
    if (item.failure_code) facts.push(["Rejected", item.failure_code]);
    if (item.decision) {
      const decision = item.decision;
      facts.push([
        "Dev decision",
        decisionText(decision) + " over " +
          (decision.complete_pairs === null ? "?" : decision.complete_pairs) + "/" + decision.planned_pairs + " pairs",
      ]);
    }
    nodes.push(el("dl", { class: "kv" }, facts.map(([key, value]) => [el("dt", { text: key }), el("dd", null, value)])));
    if (item.hypothesis) {
      nodes.push(el("h3", { text: "Hypothesis" }), el("p", { class: "prose", text: item.hypothesis }));
    }
    if (item.delta) {
      nodes.push(el("h3", { text: "Component changes (" + item.delta.attribution_kind + ")" }));
      if (item.delta.unavailable) nodes.push(el("p", { class: "subtle", text: item.delta.unavailable }));
      for (const unit of item.delta.units) {
        const section = el(
          "div",
          { id: "unit-" + encodeURIComponent(unit.unit_id) },
          el("p", null, el("span", { class: "kind", text: unit.unit_kind }), el("span", { class: "mono", text: unit.unit_id }), " " + unit.change)
        );
        for (const file of unit.files) {
          section.appendChild(el("div", { class: "diff-file", text: file.path + " (" + file.change + (file.before_bytes !== null ? ", " + file.before_bytes + " → " : ", ") + (file.after_bytes !== null ? file.after_bytes + " bytes" : "removed") + ")" }));
          section.appendChild(diffBlock(file));
        }
        if (!unit.files.length) section.appendChild(el("p", { class: "subtle", text: "Only file modes changed." }));
        nodes.push(section);
      }
    }
    nodes.push(el("h3", { text: "Scores" }), scoresTable(item));
    nodes.push(el("h3", { text: "Runs" }), runsTable(item));
    const iteration = iterationByCandidate.get(item.key);
    if (iteration) {
      nodes.push(el("h3", { text: "Iteration notes" }), iterationCard(iteration));
    }
    openDrawer(item.label, nodes);
    if (focusUnit) {
      const target = document.getElementById("unit-" + encodeURIComponent(focusUnit));
      if (target) target.scrollIntoView({ block: "start" });
    }
  }

  function openIteration(iteration) {
    if (!iteration) return;
    openDrawer(iteration.candidate_id || "iter-" + String(iteration.number).padStart(3, "0"), [iterationCard(iteration)]);
  }

  // ---------------------------------------------------------------- theme and wiring

  const THEMES = ["auto", "light", "dark"];

  function applyTheme(theme) {
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    const button = byId("theme-toggle");
    button.textContent = theme === "auto" ? "Auto" : theme === "light" ? "Light" : "Dark";
    button.setAttribute("aria-label", "Color theme: " + button.textContent);
  }

  function renderAll() {
    hideTooltip();
    renderTiles();
    renderExperiment();
    renderScores();
    renderScoreTime();
    renderCanary();
    renderIterations();
    renderComponents();
    renderHeatChips();
    renderHeatmaps();
    renderTraces();
    renderGallery();
    renderReasoning();
  }

  let theme = store.get("theme", "auto");
  if (!THEMES.includes(theme)) theme = "auto";
  applyTheme(theme);
  byId("theme-toggle").addEventListener("click", () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    store.set("theme", theme);
    applyTheme(theme);
  });
  byId("drawer-close").addEventListener("click", closeDrawer);
  byId("lightbox-close").addEventListener("click", closeLightbox);
  byId("lightbox-prev").addEventListener("click", () => stepViewer(-1, 0));
  byId("lightbox-next").addEventListener("click", () => stepViewer(1, 0));
  byId("lightbox").addEventListener("click", (event) => {
    if (event.target === byId("lightbox")) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    const viewing = !byId("lightbox").hidden;
    if (viewing) {
      const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (moves[event.key]) {
        event.preventDefault();
        stepViewer(...moves[event.key]);
        return;
      }
    }
    if (event.key !== "Escape") return;
    if (viewing) closeLightbox();
    else if (drawer.classList.contains("open")) closeDrawer();
  });
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      renderExperiment();
      renderScores();
      renderScoreTime();
      renderCanary();
      renderTraces();
    }, 150);
  });

  renderHeader();
  setupFilters();
  renderAll();
})();
