import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import RichTextEditor from '../components/RichTextEditor';
import { supabase } from '../../lib/supabase';
import {
  Home, Info, GraduationCap, HelpCircle, Calendar,
  Save, Upload, Trash2, Image, Type, Hash, FileText,
  ChevronDown, ChevronRight, RefreshCw
} from 'lucide-react';

// Types
interface SiteContentItem {
  id: string;
  page: string;
  section: string;
  key: string;
  value: string;
  content_type: 'text' | 'rich_text' | 'image_url' | 'number';
  updated_at: string;
}

type TabType = 'home' | 'about' | 'schools' | 'other' | 'footer';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  pages: string[]; // Which pages this tab covers
}

// Define content structure for each page
const CONTENT_STRUCTURE: Record<string, Record<string, { label: string; keys: { key: string; label: string; type: 'text' | 'rich_text' | 'image_url' | 'number' }[] }>> = {
  home: {
    hero: {
      label: 'Hero Section',
      keys: [
        { key: 'badge_text', label: 'Badge Text', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'subheadline', label: 'Subheadline', type: 'text' },
        { key: 'primary_cta_text', label: 'Primary Button Text', type: 'text' },
        { key: 'secondary_cta_text', label: 'Secondary Button Text', type: 'text' },
        { key: 'guarantee_label', label: 'Guarantee Label', type: 'text' },
        { key: 'guarantee_text', label: 'Guarantee Text', type: 'text' },
        { key: 'image_url', label: 'Hero Image', type: 'image_url' },
      ],
    },
    featured: {
      label: 'Featured Products Section',
      keys: [
        { key: 'label', label: 'Section Label', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'cta_text', label: 'Button Text', type: 'text' },
      ],
    },
    schools_promo: {
      label: 'Schools Promo Section',
      keys: [
        { key: 'label', label: 'Section Label', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'cta_text', label: 'Button Text', type: 'text' },
        { key: 'image_url', label: 'Section Image', type: 'image_url' },
      ],
    },
  },
  about: {
    hero: {
      label: 'Hero Section',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'subheadline', label: 'Subheadline', type: 'text' },
        { key: 'image_url', label: 'Hero Image', type: 'image_url' },
        { key: 'image_caption_label', label: 'Image Caption Label', type: 'text' },
        { key: 'image_caption_text', label: 'Image Caption Text', type: 'text' },
      ],
    },
    story: {
      label: 'Our Story Section',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'paragraph_1', label: 'Paragraph 1', type: 'rich_text' },
        { key: 'paragraph_2', label: 'Paragraph 2', type: 'text' },
        { key: 'paragraph_3', label: 'Paragraph 3', type: 'text' },
        { key: 'image_url', label: 'Story Image', type: 'image_url' },
        { key: 'founder_name', label: 'Founder Name', type: 'text' },
        { key: 'founder_title', label: 'Founder Title', type: 'text' },
        { key: 'established_year', label: 'Established Year', type: 'text' },
        { key: 'established_caption', label: 'Established Caption', type: 'text' },
      ],
    },
    seedlings: {
      label: 'Why Seedlings Section',
      keys: [
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'feature_1_title', label: 'Feature 1 Title', type: 'text' },
        { key: 'feature_1_description', label: 'Feature 1 Description', type: 'text' },
        { key: 'feature_2_title', label: 'Feature 2 Title', type: 'text' },
        { key: 'feature_2_description', label: 'Feature 2 Description', type: 'text' },
        { key: 'feature_3_title', label: 'Feature 3 Title', type: 'text' },
        { key: 'feature_3_description', label: 'Feature 3 Description', type: 'text' },
        { key: 'image_url', label: 'Section Image', type: 'image_url' },
      ],
    },
    technology: {
      label: 'Technology Section',
      keys: [
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'card_1_title', label: 'Card 1 Title', type: 'text' },
        { key: 'card_1_description', label: 'Card 1 Description', type: 'text' },
        { key: 'card_2_title', label: 'Card 2 Title', type: 'text' },
        { key: 'card_2_description', label: 'Card 2 Description', type: 'text' },
        { key: 'card_3_title', label: 'Card 3 Title', type: 'text' },
        { key: 'card_3_description', label: 'Card 3 Description', type: 'text' },
      ],
    },
    stats: {
      label: 'Team Stats',
      keys: [
        { key: 'stat_1_value', label: 'Stat 1 Value', type: 'text' },
        { key: 'stat_1_label', label: 'Stat 1 Label', type: 'text' },
        { key: 'stat_2_value', label: 'Stat 2 Value', type: 'text' },
        { key: 'stat_2_label', label: 'Stat 2 Label', type: 'text' },
        { key: 'stat_3_value', label: 'Stat 3 Value', type: 'text' },
        { key: 'stat_3_label', label: 'Stat 3 Label', type: 'text' },
        { key: 'stat_4_value', label: 'Stat 4 Value', type: 'text' },
        { key: 'stat_4_label', label: 'Stat 4 Label', type: 'text' },
      ],
    },
    growers: {
      label: 'Growers Section Header',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
      ],
    },
    values: {
      label: 'Values Section',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'value_1_title', label: 'Value 1 Title', type: 'text' },
        { key: 'value_1_description', label: 'Value 1 Description', type: 'text' },
        { key: 'value_2_title', label: 'Value 2 Title', type: 'text' },
        { key: 'value_2_description', label: 'Value 2 Description', type: 'text' },
        { key: 'value_3_title', label: 'Value 3 Title', type: 'text' },
        { key: 'value_3_description', label: 'Value 3 Description', type: 'text' },
      ],
    },
    cta: {
      label: 'CTA Section',
      keys: [
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'button_text', label: 'Button Text', type: 'text' },
      ],
    },
  },
  schools: {
    hero: {
      label: 'Hero Section',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'image_url', label: 'Hero Image', type: 'image_url' },
        { key: 'image_label', label: 'Image Label', type: 'text' },
        { key: 'image_caption', label: 'Image Caption', type: 'text' },
      ],
    },
    benefits: {
      label: 'Benefits Section',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'benefit_1_title', label: 'Benefit 1 Title', type: 'text' },
        { key: 'benefit_1_description', label: 'Benefit 1 Description', type: 'text' },
        { key: 'benefit_2_title', label: 'Benefit 2 Title', type: 'text' },
        { key: 'benefit_2_description', label: 'Benefit 2 Description', type: 'text' },
        { key: 'benefit_3_title', label: 'Benefit 3 Title', type: 'text' },
        { key: 'benefit_3_description', label: 'Benefit 3 Description', type: 'text' },
        { key: 'benefit_4_title', label: 'Benefit 4 Title', type: 'text' },
        { key: 'benefit_4_description', label: 'Benefit 4 Description', type: 'text' },
      ],
    },
    features: {
      label: 'Program Features',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'feature_1_title', label: 'Feature 1 Title', type: 'text' },
        { key: 'feature_1_description', label: 'Feature 1 Description', type: 'text' },
        { key: 'feature_2_title', label: 'Feature 2 Title', type: 'text' },
        { key: 'feature_2_description', label: 'Feature 2 Description', type: 'text' },
        { key: 'feature_3_title', label: 'Feature 3 Title', type: 'text' },
        { key: 'feature_3_description', label: 'Feature 3 Description', type: 'text' },
        { key: 'feature_4_title', label: 'Feature 4 Title', type: 'text' },
        { key: 'feature_4_description', label: 'Feature 4 Description', type: 'text' },
        { key: 'image_url', label: 'Section Image', type: 'image_url' },
        { key: 'schools_served_value', label: 'Schools Served Value', type: 'text' },
        { key: 'schools_served_label', label: 'Schools Served Label', type: 'text' },
      ],
    },
    contact: {
      label: 'Contact Section',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'email_label', label: 'Email Label', type: 'text' },
        { key: 'email', label: 'Email Address', type: 'text' },
        { key: 'phone_label', label: 'Phone Label', type: 'text' },
        { key: 'phone', label: 'Phone Number', type: 'text' },
      ],
    },
    testimonial: {
      label: 'Testimonial',
      keys: [
        { key: 'quote', label: 'Quote', type: 'rich_text' },
        { key: 'author_name', label: 'Author Name', type: 'text' },
        { key: 'author_title', label: 'Author Title', type: 'text' },
        { key: 'author_image', label: 'Author Image', type: 'image_url' },
      ],
    },
    cta: {
      label: 'CTA Section',
      keys: [
        { key: 'headline', label: 'Headline', type: 'text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'primary_button_text', label: 'Primary Button', type: 'text' },
        { key: 'secondary_button_text', label: 'Secondary Button', type: 'text' },
      ],
    },
  },
  faq: {
    header: {
      label: 'Page Header',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'text' },
      ],
    },
    cta: {
      label: 'Still Have Questions CTA',
      keys: [
        { key: 'headline', label: 'Headline', type: 'text' },
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'button_text', label: 'Button Text', type: 'text' },
      ],
    },
  },
  calendar: {
    header: {
      label: 'Page Header',
      keys: [
        { key: 'tagline', label: 'Tagline', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'text' },
        { key: 'description', label: 'Description', type: 'text' },
      ],
    },
  },
  footer: {
    main: {
      label: 'Main Footer',
      keys: [
        { key: 'tagline', label: 'Company Tagline', type: 'text' },
        { key: 'copyright_text', label: 'Copyright Text', type: 'text' },
        { key: 'built_by', label: 'Built By Text', type: 'text' },
      ],
    },
    newsletter: {
      label: 'Newsletter Section',
      keys: [
        { key: 'headline', label: 'Headline', type: 'text' },
        { key: 'description', label: 'Description', type: 'text' },
      ],
    },
  },
};

const TABS: TabConfig[] = [
  { id: 'home', label: 'Home Page', icon: <Home size={20} />, pages: ['home'] },
  { id: 'about', label: 'About Page', icon: <Info size={20} />, pages: ['about'] },
  { id: 'schools', label: 'Schools Page', icon: <GraduationCap size={20} />, pages: ['schools'] },
  { id: 'other', label: 'Other Pages', icon: <FileText size={20} />, pages: ['faq', 'calendar'] },
  { id: 'footer', label: 'Footer', icon: <FileText size={20} />, pages: ['footer'] },
];

const SiteContentPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [content, setContent] = useState<SiteContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['home-hero', 'about-hero', 'schools-hero', 'faq-header', 'footer-main']));
  const [formData, setFormData] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadKey, setCurrentUploadKey] = useState<{ page: string; section: string; key: string } | null>(null);

  // Fetch all site content
  const fetchContent = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('page')
        .order('section')
        .order('key');

      if (error) throw error;

      setContent(data || []);

      // Organize into formData structure
      const organized: Record<string, Record<string, Record<string, string>>> = {};
      (data || []).forEach((item: SiteContentItem) => {
        if (!organized[item.page]) organized[item.page] = {};
        if (!organized[item.page][item.section]) organized[item.page][item.section] = {};
        organized[item.page][item.section][item.key] = item.value;
      });
      setFormData(organized);
    } catch (error) {
      console.error('Error fetching site content:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // Update a single field
  const updateField = useCallback((page: string, section: string, key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [page]: {
        ...prev[page],
        [section]: {
          ...prev[page]?.[section],
          [key]: value,
        },
      },
    }));
    setSaveMessage(null);
  }, []);

  // Save all changes for current tab
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const currentTab = TABS.find(t => t.id === activeTab);
      if (!currentTab) return;

      const updates: { page: string; section: string; key: string; value: string; content_type: string }[] = [];

      // Gather all updates for pages in current tab
      for (const page of currentTab.pages) {
        const pageStructure = CONTENT_STRUCTURE[page];
        if (!pageStructure) continue;

        for (const [section, sectionData] of Object.entries(pageStructure)) {
          for (const field of sectionData.keys) {
            const value = formData[page]?.[section]?.[field.key] || '';
            updates.push({
              page,
              section,
              key: field.key,
              value,
              content_type: field.type,
            });
          }
        }
      }

      // Upsert all updates
      const { error } = await supabase
        .from('site_content')
        .upsert(updates, {
          onConflict: 'page,section,key',
        });

      if (error) throw error;

      setSaveMessage('Changes saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving content:', error);
      setSaveMessage('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // Toggle section expansion
  const toggleSection = (sectionKey: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadKey) return;

    const { page, section, key } = currentUploadKey;
    setUploadingImage(`${page}-${section}-${key}`);

    try {
      // Validate file
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload JPG, PNG, GIF, or WebP images.');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File is too large. Maximum size is 5MB.');
      }

      // Upload to storage
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `site-content/${page}/${section}-${key}-${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(data.path);

      // Update form data
      updateField(page, section, key, urlData.publicUrl);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(error.message || 'Failed to upload image');
    } finally {
      setUploadingImage(null);
      setCurrentUploadKey(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Trigger file input for specific field
  const triggerImageUpload = (page: string, section: string, key: string) => {
    setCurrentUploadKey({ page, section, key });
    fileInputRef.current?.click();
  };

  // Get content type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'rich_text':
        return <FileText size={14} className="text-purple-500" />;
      case 'image_url':
        return <Image size={14} className="text-blue-500" />;
      case 'number':
        return <Hash size={14} className="text-amber-500" />;
      default:
        return <Type size={14} className="text-slate-400" />;
    }
  };

  // Render field based on type
  const renderField = (page: string, section: string, field: { key: string; label: string; type: string }) => {
    const value = formData[page]?.[section]?.[field.key] || '';
    const fieldKey = `${page}-${section}-${field.key}`;
    const isUploading = uploadingImage === fieldKey;

    if (field.type === 'rich_text') {
      return (
        <div key={fieldKey} className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {getTypeIcon(field.type)}
            {field.label}
          </label>
          <RichTextEditor
            value={value}
            onChange={(v) => updateField(page, section, field.key, v)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </div>
      );
    }

    if (field.type === 'image_url') {
      return (
        <div key={fieldKey} className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {getTypeIcon(field.type)}
            {field.label}
          </label>
          <div className="flex items-start gap-4">
            {value && (
              <div className="relative group flex-shrink-0">
                <img
                  src={value}
                  alt={field.label}
                  className="w-32 h-24 object-cover rounded-xl border border-slate-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/128x96?text=No+Image';
                  }}
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerImageUpload(page, section, field.key)}
                    className="p-1.5 bg-white text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Replace"
                  >
                    <Upload size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateField(page, section, field.key, '')}
                    className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )}
            <div className="flex-1 space-y-2">
              <input
                type="url"
                value={value}
                onChange={(e) => updateField(page, section, field.key, e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                placeholder="https://example.com/image.jpg"
              />
              <button
                type="button"
                onClick={() => triggerImageUpload(page, section, field.key)}
                disabled={isUploading}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload Image
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default text input
    return (
      <div key={fieldKey} className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {getTypeIcon(field.type)}
          {field.label}
        </label>
        <input
          type={field.type === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => updateField(page, section, field.key, e.target.value)}
          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          placeholder={`Enter ${field.label.toLowerCase()}...`}
        />
      </div>
    );
  };

  // Render sections for a page
  const renderPageSections = (page: string) => {
    const structure = CONTENT_STRUCTURE[page];
    if (!structure) return null;

    return Object.entries(structure).map(([sectionKey, sectionData]) => {
      const fullKey = `${page}-${sectionKey}`;
      const isExpanded = expandedSections.has(fullKey);

      return (
        <div key={fullKey} className="border border-slate-200 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection(fullKey)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <span className="font-medium text-slate-800">{sectionData.label}</span>
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={20} className="text-slate-400" />
            </motion.div>
          </button>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-4 bg-white">
                  {sectionData.keys.map((field) => renderField(page, sectionKey, field))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  // Render tab content
  const renderTabContent = () => {
    const currentTab = TABS.find(t => t.id === activeTab);
    if (!currentTab) return null;

    return (
      <div className="space-y-4">
        {currentTab.pages.map((page) => (
          <div key={page}>
            {currentTab.pages.length > 1 && (
              <h3 className="text-lg font-semibold text-slate-800 mb-4 capitalize">{page} Page</h3>
            )}
            <div className="space-y-4">
              {renderPageSections(page)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <AdminPageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminPageWrapper>
    );
  }

  return (
    <AdminPageWrapper>
      <div className="space-y-6">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 font-admin-display">Site Content</h1>
            <p className="text-slate-500 text-sm mt-1">
              Manage text, images, and content across all pages
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200">
          <nav className="flex gap-1 overflow-x-auto pb-px">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-emerald-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeSiteContentTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500"
                    initial={false}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>

          {/* Save Button */}
          <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-slate-200">
            <AnimatePresence>
              {saveMessage && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`font-medium ${
                    saveMessage.includes('success') ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {saveMessage}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AdminPageWrapper>
  );
};

export default SiteContentPage;
