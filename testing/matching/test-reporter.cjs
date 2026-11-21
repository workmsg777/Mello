module.exports = async function* (source) {
  for await (const event of source) {
    if (event.type === "test:pass" || event.type === "test:fail") {
      const d = event.data;
      yield JSON.stringify({
        event: event.type,
        name: d.name,
        file: d.file,
        line: d.line,
        nesting: d.nesting,
        durationMs: d.details?.duration_ms,
        error: d.details?.error
          ? { message: d.details.error.message, code: d.details.error.code }
          : null,
      }) + "\n";
    }
  }
};
