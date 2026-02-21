import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminPageWrapper from '../components/AdminPageWrapper';
import RichTextEditor from '../components/RichTextEditor';
import { supabase } from '../../lib/supabase';
import { useGrowingSystems } from '../hooks/useGrowingSystems';
import {
  Home, Info, GraduationCap, HelpCircle, Calendar,
  Save, Upload, Trash2, Image, Type, Hash, FileText,
  ChevronDown, ChevronRight, RefreshCw, Palette, Video, Link
} from 'lucide-react';

// Types
interface SiteContentItem {
  id: string;
  page: string;
  section: string;
  key: string;
  value: string;
  content_type: 'text' | 'rich_text' | 'image_url' | 'video_url' | 'number';
  updated_at: string;
}

type TabType = 'home' | 'about' | 'schools' | 'other' | 'footer';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  pages: string[]; // Which pages this tab covers
}

// Field configuration with optional select options and conditional visibility
interface FieldConfig {
  key: string;
  label: string;
  type: 'text' | 'rich_text' | 'image_url' | 'video_url' | 'number' | 'select' | 'color';
  options?: string[];
  showWhen?: { key: string; value: string };
}

/** Extract YouTube video ID from URL for preview in admin */
function getYouTubeVideoId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/.test(url);
}

// Define content structure for each page
const CONTENT_STRUCTURE: Record<string, Record<string, { label: string; keys: FieldConfig[] }>> = {
  home: {
    hero: {
      label: 'Hero Section',
      keys: [
        { key: 'badge_text', label: 'Section Label', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'subheadline', label: 'Subheadline', type: 'rich_text' },
        { key: 'primary_cta_text', label: 'Primary Button Text', type: 'text' },
        { key: 'secondary_cta_text', label: 'Secondary Button Text', type: 'text' },
        { key: 'guarantee_label', label: 'Guarantee Label', type: 'text' },
        { key: 'guarantee_text', label: 'Guarantee Text', type: 'text' },
        { key: 'hero_media_type', label: 'Hero Media Type', type: 'select', options: ['image', 'video'] },
        { key: 'image_url', label: 'Hero Image', type: 'image_url', showWhen: { key: 'hero_media_type', value: 'image' } },
        { key: 'hero_video_url', label: 'Hero Video', type: 'video_url', showWhen: { key: 'hero_media_type', value: 'video' } },
      ],
    },
    featured: {
      label: 'Featured Products Section',
      keys: [
        { key: 'label', label: 'Section Label', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'rich_text' },
        { key: 'cta_text', label: 'Button Text', type: 'text' },
      ],
    },
    reviews: {
      label: 'Customer Reviews',
      keys: [
        { key: 'heading', label: 'Section Heading', type: 'text' },
        { key: 'subheading', label: 'Subheading', type: 'text' },
        { key: 'review_1_name', label: 'Review 1 - Customer Name', type: 'text' },
        { key: 'review_1_image', label: 'Review 1 - Photo (optional)', type: 'image_url' },
        { key: 'review_1_growing_system', label: 'Review 1 - Growing System', type: 'select' },
        { key: 'review_1_text', label: 'Review 1 - Review', type: 'rich_text' },
        { key: 'review_2_name', label: 'Review 2 - Customer Name', type: 'text' },
        { key: 'review_2_image', label: 'Review 2 - Photo (optional)', type: 'image_url' },
        { key: 'review_2_growing_system', label: 'Review 2 - Growing System', type: 'select' },
        { key: 'review_2_text', label: 'Review 2 - Review', type: 'rich_text' },
        { key: 'review_3_name', label: 'Review 3 - Customer Name', type: 'text' },
        { key: 'review_3_image', label: 'Review 3 - Photo (optional)', type: 'image_url' },
        { key: 'review_3_growing_system', label: 'Review 3 - Growing System', type: 'select' },
        { key: 'review_3_text', label: 'Review 3 - Review', type: 'rich_text' },
        { key: 'review_4_name', label: 'Review 4 - Customer Name', type: 'text' },
        { key: 'review_4_image', label: 'Review 4 - Photo (optional)', type: 'image_url' },
        { key: 'review_4_growing_system', label: 'Review 4 - Growing System', type: 'select' },
        { key: 'review_4_text', label: 'Review 4 - Review', type: 'rich_text' },
        { key: 'review_5_name', label: 'Review 5 - Customer Name', type: 'text' },
        { key: 'review_5_image', label: 'Review 5 - Photo (optional)', type: 'image_url' },
        { key: 'review_5_growing_system', label: 'Review 5 - Growing System', type: 'select' },
        { key: 'review_5_text', label: 'Review 5 - Review', type: 'rich_text' },
        { key: 'review_6_name', label: 'Review 6 - Customer Name', type: 'text' },
        { key: 'review_6_image', label: 'Review 6 - Photo (optional)', type: 'image_url' },
        { key: 'review_6_growing_system', label: 'Review 6 - Growing System', type: 'select' },
        { key: 'review_6_text', label: 'Review 6 - Review', type: 'rich_text' },
      ],
    },
    mission: {
      label: 'Mission Section (ATL Urban Farms Standard)',
      keys: [
        { key: 'mission_heading', label: 'Heading', type: 'text' },
        { key: 'mission_description', label: 'Description', type: 'rich_text' },
        { key: 'mission_button_text', label: 'Button Text', type: 'text' },
        { key: 'mission_button_link', label: 'Button Link', type: 'text' },
        { key: 'mission_image', label: 'Section Image (optional)', type: 'image_url' },
      ],
    },
    sproutify: {
      label: 'Sproutify App Section',
      keys: [
        { key: 'sproutify_enabled', label: 'Show Section', type: 'select', options: ['disabled', 'enabled'] },
        { key: 'sproutify_heading', label: 'Heading', type: 'text' },
        { key: 'sproutify_description', label: 'Description', type: 'rich_text' },
        { key: 'sproutify_image', label: 'App Image/Screenshot', type: 'image_url' },
        { key: 'sproutify_button_text', label: 'Button Text', type: 'text' },
        { key: 'sproutify_button_link', label: 'Button Link', type: 'text' },
      ],
    },
    schools_promo: {
      label: 'Schools Promo Section',
      keys: [
        { key: 'label', label: 'Section Label', type: 'text' },
        { key: 'headline', label: 'Headline', type: 'rich_text' },
        { key: 'description', label: 'Description', type: 'rich_text' },
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
        { key: 'paragraph_2', label: 'Paragraph 2', type: 'rich_text' },
        { key: 'paragraph_3', label: 'Paragraph 3', type: 'rich_text' },
        { key: 'image_url', label: 'Story Image', type: 'image_url' },
        { key: 'founder_name', label: 'Founder Name', type: 'text' },
        { key: 'founder_title', label: 'Founder Title', type: 'text' },
        { key: 'founder_image', label: 'Founder Image', type: 'image_url' },
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
        { key: 'card_1_link', label: 'Card 1 Link URL', type: 'text' },
        { key: 'card_2_title', label: 'Card 2 Title', type: 'text' },
        { key: 'card_2_description', label: 'Card 2 Description', type: 'text' },
        { key: 'card_2_link', label: 'Card 2 Link URL', type: 'text' },
        { key: 'card_3_title', label: 'Card 3 Title', type: 'text' },
        { key: 'card_3_description', label: 'Card 3 Description', type: 'text' },
        { key: 'card_3_link', label: 'Card 3 Link URL', type: 'text' },
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
      label: 'Growers Section Header (profiles managed in Team Members)',
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
        { key: 'button_link', label: 'Button Link URL', type: 'text' },
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<Record<string, Record<string, Record<string, string>>>>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadKey, setCurrentUploadKey] = useState<{ page: string; section: string; key: string } | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);
  const [currentVideoUploadKey, setCurrentVideoUploadKey] = useState<{ page: string; section: string; key: string } | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState<string | null>(null);
  const { systems: growingSystems } = useGrowingSystems();

  // Fetch all site content (showLoading=false for silent refetch after save)
  const fetchContent = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
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
      if (showLoading) setLoading(false);
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
              content_type: (field.type === 'select' || field.type === 'color') ? 'text' : field.type,
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

      // Silently refetch content from DB to ensure formData stays in sync
      await fetchContent(false);

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

  // Handle video upload
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentVideoUploadKey) return;

    const { page, section, key } = currentVideoUploadKey;
    setUploadingVideo(`${page}-${section}-${key}`);

    try {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload MP4, WebM, or MOV video files.');
      }
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('File is too large. Maximum video size is 100MB.');
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `videos/${page}/${section}-${key}-${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('site-media')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('site-media')
        .getPublicUrl(data.path);

      updateField(page, section, key, urlData.publicUrl);
    } catch (error: any) {
      console.error('Video upload error:', error);
      alert(error.message || 'Failed to upload video');
    } finally {
      setUploadingVideo(null);
      setCurrentVideoUploadKey(null);
      if (videoFileInputRef.current) {
        videoFileInputRef.current.value = '';
      }
    }
  };

  // Trigger video file input for specific field
  const triggerVideoUpload = (page: string, section: string, key: string) => {
    setCurrentVideoUploadKey({ page, section, key });
    videoFileInputRef.current?.click();
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
      case 'color':
        return <Palette size={14} className="text-pink-500" />;
      case 'video_url':
        return <Video size={14} className="text-red-500" />;
      default:
        return <Type size={14} className="text-slate-400" />;
    }
  };

  // Render field based on type
  const renderField = (page: string, section: string, field: FieldConfig) => {
    // Conditional visibility: check showWhen condition
    if (field.showWhen) {
      const depValue = formData[page]?.[section]?.[field.showWhen.key] || '';
      // Default to 'image' for hero_media_type when empty (preserves existing behavior)
      const effectiveValue = depValue || (field.showWhen.key === 'hero_media_type' ? 'image' : '');
      if (effectiveValue !== field.showWhen.value) return null;
    }

    const value = formData[page]?.[section]?.[field.key] || '';
    const fieldKey = `${page}-${section}-${field.key}`;
    const isUploading = uploadingImage === fieldKey;

    if (field.type === 'select') {
      // Use dynamic growing systems for growing_system fields, static options otherwise
      const isGrowingSystemField = field.key.endsWith('_growing_system');
      const options = isGrowingSystemField
        ? ['', ...growingSystems.filter(s => s.is_active).map(s => s.name)]
        : field.options || [];

      return (
        <div key={fieldKey} className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {getTypeIcon(field.type)}
            {field.label}
          </label>
          <select
            value={value || options[0]}
            onChange={(e) => updateField(page, section, field.key, e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all capitalize"
          >
            {options.map((opt) => (
              <option key={opt || '__none__'} value={opt} className="capitalize">{opt ? opt.charAt(0).toUpperCase() + opt.slice(1) : isGrowingSystemField ? 'Select Growing System' : '(None)'}</option>
            ))}
          </select>
        </div>
      );
    }

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

    if (field.type === 'video_url') {
      const isYT = value && isYouTubeUrl(value);
      const isDirectVideo = value && !isYT && (value.startsWith('http') || value.startsWith('/'));
      const isVideoUploading = uploadingVideo === fieldKey;

      return (
        <div key={fieldKey} className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {getTypeIcon(field.type)}
            {field.label}
          </label>

          {/* Video preview */}
          {value && (
            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-black max-w-md">
              {isYT ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${getYouTubeVideoId(value)}?controls=1&modestbranding=1`}
                    title="Video preview"
                    className="absolute inset-0 w-full h-full"
                    style={{ border: 'none' }}
                    allow="encrypted-media"
                  />
                </div>
              ) : isDirectVideo ? (
                <video
                  src={value}
                  controls
                  muted
                  className="w-full h-auto max-h-48 object-contain"
                  preload="metadata"
                />
              ) : null}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

          {/* URL input for YouTube or direct URLs */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Link size={16} className="text-slate-400 flex-shrink-0" />
              <input
                type="url"
                value={value}
                onChange={(e) => updateField(page, section, field.key, e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-sm"
                placeholder="Paste YouTube URL or video file URL..."
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <button
              type="button"
              onClick={() => triggerVideoUpload(page, section, field.key)}
              disabled={isVideoUploading}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors w-full justify-center"
            >
              {isVideoUploading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  Uploading video...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload Video File
                  <span className="text-xs text-slate-400 ml-1">(MP4, WebM, MOV — max 100MB)</span>
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    if (field.type === 'color') {
      return (
        <div key={fieldKey} className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {getTypeIcon(field.type)}
            {field.label}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={value || '#FFFFFF'}
              onChange={(e) => updateField(page, section, field.key, e.target.value)}
              className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={value || '#FFFFFF'}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                  updateField(page, section, field.key, v);
                }
              }}
              onBlur={() => {
                // Normalize partial hex to valid 7-char hex on blur
                const current = formData[page]?.[section]?.[field.key] || '';
                if (/^#[0-9A-Fa-f]{6}$/.test(current)) return; // already valid
                if (/^#[0-9A-Fa-f]{3}$/.test(current)) {
                  // Expand shorthand: #RGB → #RRGGBB
                  const expanded = '#' + current[1] + current[1] + current[2] + current[2] + current[3] + current[3];
                  updateField(page, section, field.key, expanded);
                } else {
                  // Reset invalid/partial hex to white
                  updateField(page, section, field.key, '#FFFFFF');
                }
              }}
              className="w-28 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              placeholder="#FFFFFF"
            />
            <div
              className="w-10 h-10 rounded-lg border border-slate-200"
              style={{ backgroundColor: value || '#FFFFFF' }}
            />
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
                  {sectionKey === 'reviews' ? (() => {
                    // Separate heading/subheading fields from individual review fields
                    const sectionFields = sectionData.keys.filter(f => !f.key.startsWith('review_'));
                    const reviewFields = sectionData.keys.filter(f => f.key.startsWith('review_'));
                    // Group by review number (review_1_*, review_2_*, etc.)
                    const reviewGroups: Record<string, typeof reviewFields> = {};
                    reviewFields.forEach(f => {
                      const match = f.key.match(/^review_(\d+)_/);
                      if (match) {
                        const num = match[1];
                        if (!reviewGroups[num]) reviewGroups[num] = [];
                        reviewGroups[num].push(f);
                      }
                    });
                    return (
                      <>
                        {sectionFields.map((field) => renderField(page, sectionKey, field))}
                        <div className="space-y-5 mt-2">
                          {Object.entries(reviewGroups).map(([num, fields], idx) => (
                            <div
                              key={num}
                              className={`rounded-xl border border-slate-200 shadow-sm overflow-hidden ${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}
                            >
                              <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-100/60">
                                <h4 className="text-sm font-semibold text-slate-600">Review #{num}</h4>
                              </div>
                              <div className="p-4 space-y-4">
                                {fields.map((field) => renderField(page, sectionKey, field))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })() : sectionData.keys.map((field) => renderField(page, sectionKey, field))}
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
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />
        <input
          ref={videoFileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleVideoUpload}
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
