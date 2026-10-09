import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { AnimatedIcon } from "./AnimatedIcon";

export function Overlay({
  open,
  onClose,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-background/75 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed right-0 top-0 z-50 h-dvh w-full ${wide ? "max-w-3xl" : "max-w-md"} overflow-y-auto border-l bg-card p-5 pt-12 shadow-2xl sm:p-6 sm:pt-12`}
        >
          <Dialog.Title className="sr-only">
            {wide ? "Recipe and extension library" : "Langplay settings"}
          </Dialog.Title>
          <Dialog.Close asChild>
            <Button
              variant="outline"
              aria-label="Close"
              size="icon"
              className="absolute right-4 top-3"
            >
              <AnimatedIcon name="close" />
            </Button>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
