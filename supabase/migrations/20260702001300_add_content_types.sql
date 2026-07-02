-- Add new values to content_type enum for Mais atividades tab
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'gravacao';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'roteiro';
ALTER TYPE content_type ADD VALUE IF NOT EXISTS 'sistema';
