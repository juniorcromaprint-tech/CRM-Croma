"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl, altText = "Imagem em tela cheia" }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none shadow-none">
        <DialogHeader className="absolute top-2 right-2 z-50">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:text-slate-300 bg-black/30 rounded-full h-10 w-10">
            <X size={24} />
          </Button>
        </DialogHeader>
        <div className="flex justify-center items-center">
          <img src={imageUrl} alt={altText} className="max-h-[80vh] max-w-[90vw] object-contain rounded-lg shadow-xl" />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageModal;