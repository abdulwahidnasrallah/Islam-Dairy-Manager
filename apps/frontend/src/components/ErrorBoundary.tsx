import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Top-level error boundary. Never let a rendering error show a blank
 * white screen — always fall back to a friendly Arabic message.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Foundation phase: log to console only.
    // Later phases send this to the desktop error-log service.
    console.error("Unhandled UI error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-surface-muted text-center">
          <h1 className="text-xl font-bold text-danger">حدث خطأ غير متوقع</h1>
          <p className="text-gray-600">الرجاء إعادة تشغيل التطبيق. لم يتم فقدان أي بيانات.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
