type ProcessButtonProps = {
  onClick: () => void;
  disabled: boolean;
  isLoading: boolean;
};

function ProcessButton({ onClick, disabled, isLoading }: ProcessButtonProps) {
  return (
    <button
      type="button"
      className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-violet-600 px-4 py-2 font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      onClick={onClick}
      disabled={disabled}
    >
      {isLoading && (
        <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-200 border-t-white" />
      )}
      <span>Lancer le traitement</span>
    </button>
  );
}

export default ProcessButton;
