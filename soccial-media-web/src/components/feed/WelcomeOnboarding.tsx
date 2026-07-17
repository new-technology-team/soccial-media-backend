import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { X, ChevronRight, Camera, UserPlus, Edit3, Search } from "lucide-react";

interface WelcomeOnboardingProps {
  fullName: string;
  onDismiss: () => void;
  hasFriends: boolean;
  hasPosts: boolean;
}

export default function WelcomeOnboarding({
  fullName,
  onDismiss,
  hasFriends,
  hasPosts,
}: WelcomeOnboardingProps) {
  const [dismissed, setDismissed] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem("welcome_dismissed");
    if (stored) setDismissed(true);
  }, []);

  if (dismissed) return null;

  const steps = hasPosts
    ? [
        {
          icon: Search,
          title: "Khám phá nội dung",
          description: "Bảng tin của bạn đang hiển thị các bài viết đề xuất. Kết bạn để xem thêm nội dung từ bạn bè!",
          action: "Tiếp theo",
        },
        {
          icon: UserPlus,
          title: "Kết nối bạn bè",
          description: "Tìm kiếm và kết bạn để bảng tin thêm sôi động. Bạn cũng có thể chia sẻ bài viết của mình!",
          action: "Bắt đầu nào!",
        },
      ]
    : [
        {
          icon: Edit3,
          title: "Chào mừng bạn đến với ZChat!",
          description: `Chào ${fullName}, hãy tạo bài viết đầu tiên để chia sẻ với cộng đồng. Bảng tin của bạn đang hiển thị những nội dung thú vị nhất!`,
          action: "Tạo bài viết",
        },
        {
          icon: UserPlus,
          title: "Kết bạn ngay!",
          description: "Gợi ý kết bạn ở cột bên phải. Kết bạn để xem bài viết từ những người bạn quan tâm.",
          action: "Khám phá ngay!",
        },
        {
          icon: Search,
          title: "Bảng tin thông minh",
          description: "Khi chưa có bạn bè, chúng tôi sẽ đề xuất nội dung thịnh hành và thú vị dành riêng cho bạn!",
          action: "Bắt đầu nào!",
        },
      ];

  const step = steps[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === steps.length - 1;

  const handleAction = () => {
    if (isLastStep) {
      setDismissed(true);
      sessionStorage.setItem("welcome_dismissed", "1");
      onDismiss();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    setDismissed(true);
    sessionStorage.setItem("welcome_dismissed", "1");
    onDismiss();
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 shadow-lg">
      <button
        type="button"
        onClick={handleSkip}
        className="absolute right-2 top-2 rounded-full bg-white/20 p-1 text-white/80 hover:bg-white/30 hover:text-white transition-colors"
      >
        <X size={16} />
      </button>

      <div className="px-5 py-6 sm:px-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
            <Icon size={20} />
          </span>
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === currentStep ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        <h3 className="mb-2 text-lg font-bold text-white">{step.title}</h3>
        <p className="mb-4 text-sm leading-relaxed text-white/85">
          {step.description}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleAction}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition-all hover:bg-blue-50 active:scale-95"
          >
            {step.action}
            <ChevronRight size={16} />
          </button>
          {!isLastStep && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              Bỏ qua
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
