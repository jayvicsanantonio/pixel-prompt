type AbortClassification = "timeout" | "interrupted" | null;

function createAbortReason(name: "AbortError" | "TimeoutError", message: string) {
  if (typeof DOMException === "function") {
    return new DOMException(message, name);
  }

  return Object.assign(new Error(message), { name });
}

function getReasonName(reason: unknown) {
  if (!reason || typeof reason !== "object") {
    return null;
  }

  return "name" in reason && typeof reason.name === "string" ? reason.name : null;
}

export function createProviderAbortState(input: {
  interruptedMessage: string;
  requestSignal?: AbortSignal;
  timeoutMessage: string;
  timeoutMs: number;
}) {
  const controller = new AbortController();
  const timeoutReason = createAbortReason("TimeoutError", input.timeoutMessage);
  const interruptedReason = createAbortReason("AbortError", input.interruptedMessage);
  const abortFromRequestSignal = () => {
    if (!controller.signal.aborted) {
      controller.abort(input.requestSignal?.reason ?? interruptedReason);
    }
  };
  const timeoutHandle = setTimeout(() => {
    if (!controller.signal.aborted) {
      controller.abort(timeoutReason);
    }
  }, input.timeoutMs);

  timeoutHandle.unref?.();

  if (input.requestSignal) {
    if (input.requestSignal.aborted) {
      abortFromRequestSignal();
    } else {
      input.requestSignal.addEventListener("abort", abortFromRequestSignal, { once: true });
    }
  }

  return {
    signal: controller.signal,
    classifyError(error: unknown): AbortClassification {
      const errorName = error instanceof Error ? error.name : getReasonName(error);

      if (errorName === "TimeoutError") {
        return "timeout";
      }

      const reasonName = getReasonName(controller.signal.reason);

      if (reasonName === "TimeoutError") {
        return "timeout";
      }

      if (errorName === "AbortError") {
        return "interrupted";
      }

      if (reasonName === "AbortError") {
        return "interrupted";
      }

      if (controller.signal.aborted) {
        return "interrupted";
      }

      return null;
    },
    cleanup() {
      clearTimeout(timeoutHandle);
      input.requestSignal?.removeEventListener("abort", abortFromRequestSignal);
    },
  };
}
