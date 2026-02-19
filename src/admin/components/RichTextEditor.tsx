import React, { useCallback, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Link as LinkIcon, Unlink, Palette, ImagePlus, Video } from 'lucide-react';
import { useBrandingSettings } from '../../hooks/useSupabase';
import { supabase } from '../../lib/supabase';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const MenuButton: React.FC<{
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, isActive, disabled, title, children }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-2 rounded-lg transition-colors ${
      isActive
        ? 'bg-emerald-100 text-emerald-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const RECENT_COLORS_KEY = 'atluf_recent_colors';
const MAX_RECENT_COLORS = 8;

function getRecentColors(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentColor(hex: string) {
  try {
    const normalized = hex.toLowerCase();
    const recent = getRecentColors().filter((c) => c !== normalized);
    recent.unshift(normalized);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT_COLORS)));
  } catch {
    // localStorage unavailable
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder }) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customHex, setCustomHex] = useState('#000000');
  const [customRgb, setCustomRgb] = useState({ r: 0, g: 0, b: 0 });
  const [recentColors, setRecentColors] = useState<string[]>(getRecentColors);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const colorButtonRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const { settings: brandingSettings } = useBrandingSettings();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-emerald-600 underline hover:text-emerald-700',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-xl max-w-full h-auto',
        },
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: 'rounded-xl w-full',
        },
        width: 640,
        height: 360,
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Position color picker and close on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    // Calculate position from button ref
    if (colorButtonRef.current) {
      const rect = colorButtonRef.current.getBoundingClientRect();
      setPickerPos({ top: rect.bottom + 4, left: rect.left });
    }
    const handleClick = (e: MouseEvent) => {
      if (
        colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node) &&
        colorButtonRef.current && !colorButtonRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showColorPicker]);

  // Sync hex/rgb when color picker opens with current text color
  useEffect(() => {
    if (showColorPicker && editor) {
      const currentColor = editor.getAttributes('textStyle').color || '#000000';
      setCustomHex(currentColor);
      const rgb = hexToRgb(currentColor);
      if (rgb) setCustomRgb(rgb);
    }
  }, [showColorPicker, editor]);

  const updateFromHex = (hex: string) => {
    setCustomHex(hex);
    const rgb = hexToRgb(hex);
    if (rgb) setCustomRgb(rgb);
  };

  const updateFromRgb = (channel: 'r' | 'g' | 'b', val: number) => {
    const next = { ...customRgb, [channel]: val };
    setCustomRgb(next);
    setCustomHex(rgbToHex(next.r, next.g, next.b));
  };

  const applyColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
    saveRecentColor(color);
    setRecentColors(getRecentColors());
    setShowColorPicker(false);
  };

  const applyCustomColor = () => {
    applyColor(customHex);
  };

  // Build brand color presets from settings
  const brandColors: { color: string; label: string }[] = [];
  if (brandingSettings?.primary_brand_color) {
    brandColors.push({ color: brandingSettings.primary_brand_color, label: 'Primary' });
  }
  if (brandingSettings?.secondary_brand_color) {
    brandColors.push({ color: brandingSettings.secondary_brand_color, label: 'Secondary' });
  }
  if (brandingSettings?.background_color && brandingSettings.background_color !== '#fafafa') {
    brandColors.push({ color: brandingSettings.background_color, label: 'Background' });
  }
  if (brandingSettings?.secondary_background_color && brandingSettings.secondary_background_color !== '#ffffff') {
    brandColors.push({ color: brandingSettings.secondary_background_color, label: 'Sec. BG' });
  }

  const setLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setShowLinkInput(false);
      return;
    }

    const url = linkUrl.match(/^https?:\/\//) ? linkUrl : `https://${linkUrl}`;

    editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url })
      .run();

    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const handleLinkButtonClick = () => {
    if (!editor) return;

    const previousUrl = editor.getAttributes('link').href;
    if (previousUrl) {
      setLinkUrl(previousUrl);
    }
    setShowLinkInput(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !editor) return;

    setUploadingImage(true);
    try {
      const file = files[0];
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file is too large. Maximum size is 5MB.');
        return;
      }

      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `blog/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('product-images').getPublicUrl(filePath);
      editor.chain().focus().setImage({ src: publicUrl, alt: file.name }).run();
    } catch (err: any) {
      alert(err?.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const insertVideo = useCallback(() => {
    if (!editor || !videoUrl.trim()) return;
    editor.commands.setYoutubeVideo({ src: videoUrl.trim() });
    setVideoUrl('');
    setShowVideoInput(false);
  }, [editor, videoUrl]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-200 bg-slate-50 flex-wrap">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold size={18} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic size={18} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={18} />
        </MenuButton>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={18} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered size={18} />
        </MenuButton>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <MenuButton
          onClick={handleLinkButtonClick}
          isActive={editor.isActive('link')}
          title="Add Link"
        >
          <LinkIcon size={18} />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().unsetLink().run()}
          disabled={!editor.isActive('link')}
          title="Remove Link"
        >
          <Unlink size={18} />
        </MenuButton>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <div ref={colorButtonRef}>
          <MenuButton
            onClick={() => setShowColorPicker(!showColorPicker)}
            isActive={!!editor.getAttributes('textStyle').color}
            title="Text Color"
          >
            <Palette size={18} />
            {editor.getAttributes('textStyle').color && (
              <span
                className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-0.5 rounded-full"
                style={{ backgroundColor: editor.getAttributes('textStyle').color }}
              />
            )}
          </MenuButton>
        </div>

        <div className="w-px h-6 bg-slate-200 mx-1" />

        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        <MenuButton
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingImage}
          title="Insert Image"
        >
          {uploadingImage ? (
            <div className="w-[18px] h-[18px] border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImagePlus size={18} />
          )}
        </MenuButton>

        <MenuButton
          onClick={() => setShowVideoInput(!showVideoInput)}
          title="Embed YouTube Video"
        >
          <Video size={18} />
        </MenuButton>

        {showColorPicker && createPortal(
          <div
            ref={colorPickerRef}
            className="fixed p-3 bg-white border border-slate-200 rounded-xl shadow-lg w-64 max-h-[80vh] overflow-y-auto"
            style={{ top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
          >
            {/* Brand Colors */}
            {brandColors.length > 0 && (
              <div className="mb-2.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Brand Colors</p>
                <div className="flex gap-1.5">
                  {brandColors.map(({ color, label }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => applyColor(color)}
                      className="flex flex-col items-center gap-0.5 group"
                      title={`${label}: ${color}`}
                    >
                      <span
                        className="w-7 h-7 rounded-lg border-2 border-slate-200 group-hover:scale-110 group-hover:border-slate-400 transition-all"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[9px] text-slate-400 group-hover:text-slate-600">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Recently Used */}
            {recentColors.length > 0 && (
              <div className="mb-2.5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Recent</p>
                <div className="flex gap-1.5">
                  {recentColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => applyColor(color)}
                      className={`w-6 h-6 rounded-md border hover:scale-110 transition-transform ${
                        color === '#ffffff' ? 'border-slate-300' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Standard Colors */}
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Colors</p>
            <div className="grid grid-cols-8 gap-1.5 mb-2.5">
              {[
                '#000000', '#374151', '#6B7280', '#9CA3AF', '#EF4444', '#F97316', '#F59E0B', '#EAB308',
                '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#FFFFFF',
                '#991B1B', '#9A3412', '#92400E', '#065F46', '#155E75', '#1E3A8A', '#4C1D95', '#831843',
              ].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => applyColor(color)}
                  className={`w-6 h-6 rounded-md border hover:scale-110 transition-transform ${
                    color === '#FFFFFF' ? 'border-slate-300' : 'border-slate-200'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>

            {/* Custom Color Section */}
            <div className="pt-2.5 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Custom</p>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="color"
                  value={customHex}
                  onChange={(e) => updateFromHex(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200 p-0 bg-transparent"
                  title="Pick custom color"
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={(e) => {
                    const v = e.target.value;
                    setCustomHex(v);
                    const rgb = hexToRgb(v);
                    if (rgb) setCustomRgb(rgb);
                  }}
                  className="flex-1 px-2 py-1.5 text-xs font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-400"
                  placeholder="#000000"
                  maxLength={7}
                />
              </div>
              <div className="flex items-center gap-1.5 mb-2.5">
                {(['r', 'g', 'b'] as const).map((ch) => (
                  <div key={ch} className="flex-1">
                    <label className="block text-[10px] font-medium text-slate-400 uppercase text-center mb-0.5">{ch}</label>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={customRgb[ch]}
                      onChange={(e) => updateFromRgb(ch, Math.max(0, Math.min(255, parseInt(e.target.value) || 0)))}
                      className="w-full px-1.5 py-1.5 text-xs text-center border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applyCustomColor}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetColor().run();
                    setShowColorPicker(false);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {showLinkInput && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Enter URL..."
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-48"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setLink();
                }
                if (e.key === 'Escape') {
                  setShowLinkInput(false);
                  setLinkUrl('');
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={setLink}
              className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={() => {
                setShowLinkInput(false);
                setLinkUrl('');
              }}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {showVideoInput && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="YouTube URL..."
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-56"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertVideo();
                }
                if (e.key === 'Escape') {
                  setShowVideoInput(false);
                  setVideoUrl('');
                }
              }}
              autoFocus
            />
            <button
              type="button"
              onClick={insertVideo}
              className="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Embed
            </button>
            <button
              type="button"
              onClick={() => {
                setShowVideoInput(false);
                setVideoUrl('');
              }}
              className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <EditorContent editor={editor} />

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #94a3b8;
          content: '${placeholder || 'Enter description...'}';
          float: left;
          height: 0;
          pointer-events: none;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror p {
          margin: 0.5rem 0;
        }
        .ProseMirror:focus {
          outline: none;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.75rem;
          margin: 0.75rem 0;
        }
        .ProseMirror div[data-youtube-video] {
          margin: 0.75rem 0;
        }
        .ProseMirror div[data-youtube-video] iframe {
          border-radius: 0.75rem;
          width: 100%;
          aspect-ratio: 16/9;
          height: auto;
        }
      `}</style>
    </div>
  );
};

export default RichTextEditor;
