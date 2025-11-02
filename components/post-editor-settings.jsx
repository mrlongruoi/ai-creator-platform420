"use client";

import React, { useState } from "react";
import PropTypes from "prop-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

const CATEGORIES = [
  "Technology",
  "Design",
  "Marketing",
  "Business",
  "Lifestyle",
  "Education",
  "Health",
  "Travel",
  "Food",
  "Entertainment",
];

export default function PostEditorSettings({ isOpen, onClose, form, mode }) {
  const [tagInput, setTagInput] = useState("");
  const { watch, setValue } = form;
  const watchedValues = watch();

  const handleTagInput = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (
      tag &&
      !watchedValues.tags.includes(tag) &&
      watchedValues.tags.length < 10
    ) {
      setValue("tags", [...watchedValues.tags, tag]);
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove) => {
    setValue(
      "tags",
      watchedValues.tags.filter((tag) => tag !== tagToRemove)
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Post Settings</DialogTitle>
          <DialogDescription>Configure your post details</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Category */}
          <div className="space-y-2">
            <Label className="text-white text-sm font-medium">Category</Label>
            <Select
              value={watchedValues.category}
              onValueChange={(value) => setValue("category", value)}
            >
              <SelectTrigger className="bg-slate-800 border-slate-600" aria-labelledby="category-label">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label htmlFor="tags-input" className="text-white text-sm font-medium">Tags</Label>
            <div className="flex space-x-2">
              <Input
                id="tags-input"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInput}
                placeholder="Add tags..."
                className="bg-slate-800 border-slate-600"
              />
              <Button
                type="button"
                onClick={addTag}
                variant="outline"
                size="sm"
                className="border-slate-600"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {watchedValues.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {watchedValues.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="bg-purple-500/20 text-purple-300 border-purple-500/30"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-400"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <p className="text-xs text-slate-400">
              {watchedValues.tags.length}/10 tags • Press Enter or comma to add
            </p>
          </div>

          {/* Scheduling */}
          {mode === "create" && (
            <div className="space-y-2">
              <Label htmlFor="scheduled-for" className="text-white text-sm font-medium">
                Schedule Publication
              </Label>
              <Input
                id="scheduled-for"
                value={watchedValues.scheduledFor}
                onChange={(e) => setValue("scheduledFor", e.target.value)}
                type="datetime-local"
                className="bg-slate-800 border-slate-600"
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-slate-400">
                Leave empty to publish immediately
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

PostEditorSettings.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  form: PropTypes.shape({
    watch: PropTypes.func.isRequired,
    setValue: PropTypes.func.isRequired,
  }).isRequired,
  mode: PropTypes.oneOf(["create", "edit"]).isRequired,
};
