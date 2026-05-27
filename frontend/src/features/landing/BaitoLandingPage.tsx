import { useCallback, useEffect, useRef, useState, type ElementType } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Search, ChevronDown, ArrowRight, Star, MapPin,
  Code, Palette, TrendingUp, Scale, Calculator,
  HardHat, Heart, BookOpen, Camera, Scissors,
  Shield, Monitor, MessageSquare, Zap,
  Check, Menu
} from "lucide-react";

import { listCategories, type ApiCategory } from "../categories/api";
import { getMe, listListings, listProviders, type Listing as ApiListing } from "../marketplace/api";
import { getAdminToken } from "../../shared/session/admin-session";
import { clearUserSession, getUserToken } from "../../shared/session/user-session";

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --fg: #0a0a0a;
    --bg: #f9f9f8;
    --white: #ffffff;
    --g50: #f5f5f4;
    --g100: #e7e7e5;
    --g200: #d4d4d1;
    --g300: #b5b5b1;
    --g400: #8f8f8b;
    --g500: #6b6b67;
    --g600: #525250;
    --g700: #3d3d3b;
    --g800: #282826;
    --g900: #161614;
    --font: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    --r: 8px;
    --ease: cubic-bezier(0.4, 0, 0.2, 1);
    --spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    --t: 0.18s;
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--fg);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.5;
  }

  button { font-family: var(--font); cursor: pointer; }
  a { text-decoration: none; color: inherit; }

  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 200;
    height: 56px;
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    background: rgba(249,249,248,0.82);
    border-bottom: 1px solid transparent;
    transition: border-color 0.25s var(--ease), background 0.25s var(--ease);
  }
  .nav.scrolled {
    border-bottom-color: var(--g100);
    background: rgba(249,249,248,0.96);
  }
  .nav-inner {
    max-width: 1280px; margin: 0 auto; height: 100%;
    display: flex; align-items: center; padding: 0 28px; gap: 0;
  }

  .logo { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .logo-mark {
    width: 36px; height: 36px;
    border: 1.5px solid var(--fg);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px; font-weight: 900;
    transition: background var(--t) var(--ease), color var(--t) var(--ease), transform 0.3s var(--spring);
    font-family: var(--font);
    user-select: none;
    color: var(--fg);
    background: transparent;
  }
  .logo:hover .logo-mark {
    background: var(--fg); color: var(--white);
    transform: rotate(-4deg) scale(1.05);
  }
  .logo-wordmark { display: flex; flex-direction: column; gap: 0; }
  .logo-name { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.1; }
  .logo-tagline { font-size: 10px; color: var(--g400); letter-spacing: 0.08em; text-transform: uppercase; line-height: 1; }

  .nav-links {
    display: flex; align-items: center; gap: 2px;
    margin-left: 36px;
  }
  .nav-link {
    position: relative; display: flex; align-items: center; gap: 4px;
    padding: 6px 12px; border-radius: 6px;
    font-size: 13.5px; font-weight: 500; color: var(--g500);
    background: none; border: none;
    transition: color var(--t) var(--ease), background var(--t) var(--ease);
    white-space: nowrap;
  }
  .nav-link::after {
    content: ''; position: absolute;
    bottom: 2px; left: 12px; right: 12px;
    height: 1.5px; background: var(--fg);
    transform: scaleX(0); transform-origin: center;
    transition: transform 0.22s var(--ease);
  }
  .nav-link:hover { color: var(--fg); background: var(--g50); }
  .nav-link:hover::after { transform: scaleX(1); }
  .nav-link.active { color: var(--fg); }
  .nav-link.active::after { transform: scaleX(1); }
  .nav-link .chev { transition: transform 0.2s var(--ease); color: var(--g400); }
  .nav-link.open .chev { transform: rotate(180deg); }

  .dd-wrap { position: relative; }
  .dd {
    position: absolute; top: calc(100% + 10px); left: 0;
    min-width: 228px; background: var(--white);
    border: 1px solid var(--g100); border-radius: 12px;
    overflow: hidden; z-index: 300;
    opacity: 0; transform: translateY(-6px) scale(0.98);
    pointer-events: none;
    transition: opacity 0.18s var(--ease), transform 0.18s var(--ease);
    box-shadow: 0 1px 0 var(--g100);
  }
  .dd.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: all; }
  .dd-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--g50);
    font-size: 13.5px; font-weight: 500; color: var(--g600);
    transition: background var(--t), color var(--t);
    cursor: pointer;
  }
  .dd-row:last-child { border-bottom: none; }
  .dd-row:hover { background: var(--g50); color: var(--fg); }
  .dd-icon {
    width: 28px; height: 28px; border: 1px solid var(--g100);
    border-radius: 6px; display: flex; align-items: center; justify-content: center;
    color: var(--g400); flex-shrink: 0;
    transition: border-color var(--t), color var(--t), transform 0.25s var(--spring);
  }
  .dd-row:hover .dd-icon { border-color: var(--fg); color: var(--fg); transform: rotate(-6deg) scale(1.1); }
  .dd-count { margin-left: auto; font-size: 11.5px; color: var(--g400); font-weight: 400; }

  .nav-auth { margin-left: auto; display: flex; align-items: center; gap: 6px; }
  .btn-ghost-sm {
    padding: 7px 16px; font-size: 13.5px; font-weight: 500;
    color: var(--g500); background: none; border: none; border-radius: 6px;
    transition: color var(--t), background var(--t);
  }
  .btn-ghost-sm:hover { color: var(--fg); background: var(--g50); }
  .btn-solid-sm {
    padding: 7px 18px; font-size: 13.5px; font-weight: 600;
    color: var(--white); background: var(--fg);
    border: 1.5px solid var(--fg); border-radius: 6px;
    transition: background var(--t);
  }
  .btn-solid-sm:hover { background: var(--g800); }
  .mobile-menu-btn { display: none; background: none; border: none; color: var(--g600); padding: 6px; }

  .hero {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 120px 28px 80px; position: relative; overflow: hidden;
  }
  .hero-grid {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      radial-gradient(circle at 50% 35%, rgba(10,10,10,0.05), transparent 34%),
      linear-gradient(180deg, rgba(255,255,255,0.65) 0%, rgba(249,249,248,1) 100%);
    opacity: 1;
  }
  .hero-katakana {
    position: absolute;
    right: 7%;
    top: 50%;
    transform: translateY(-50%);
    font-size: clamp(72px, 11vw, 160px);
    font-weight: 800;
    color: var(--g100);
    line-height: 1;
    pointer-events: none;
    letter-spacing: -0.06em;
    user-select: none;
    font-family: var(--font);
  }
  .hero-inner {
    max-width: 820px; width: 100%; margin: 0 auto;
    text-align: center; position: relative; z-index: 1;
  }
  .hero-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 5px 14px 5px 5px; border: 1px solid var(--g200);
    border-radius: 100px; font-size: 12.5px; font-weight: 500; color: var(--g500);
    background: rgba(255,255,255,0.7); backdrop-filter: blur(8px);
    margin-bottom: 32px;
    animation: fadeUp 0.5s var(--ease) 0.05s both;
  }
  .hero-pill-dot {
    width: 20px; height: 20px; background: var(--fg); border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .hero-pill-dot span { font-size: 10px; color: white; font-family: var(--font); font-weight: 900; }
  .hero-h1 {
    font-size: clamp(38px, 6.5vw, 76px); font-weight: 800;
    letter-spacing: -0.035em; line-height: 1.08; color: var(--fg);
    margin-bottom: 22px;
    animation: fadeUp 0.55s var(--ease) 0.1s both;
  }
  .hero-h1 .underline { position: relative; display: inline-block; }
  .hero-h1 .underline::after {
    content: ''; position: absolute; bottom: 3px; left: 0; right: 0;
    height: 4px; background: var(--fg); border-radius: 2px;
  }
  .hero-sub {
    font-size: clamp(15px, 2.2vw, 19px); color: var(--g400);
    max-width: 480px; margin: 0 auto 44px; line-height: 1.65; font-weight: 400;
    animation: fadeUp 0.55s var(--ease) 0.16s both;
  }

  .search-wrap { max-width: 680px; margin: 0 auto; animation: fadeUp 0.55s var(--ease) 0.22s both; }
  .search-bar {
    display: flex; align-items: center;
    background: var(--white); border: 1.5px solid var(--g200);
    border-radius: 10px; overflow: visible;
    transition: border-color 0.2s; position: relative;
    margin-bottom: 14px;
  }
  .search-bar.focused { border-color: var(--fg); }
  .search-cat-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 0 16px; height: 54px; min-width: 148px;
    border-right: 1.5px solid var(--g100);
    font-size: 13.5px; font-weight: 500; color: var(--g600);
    background: none; border-top: none; border-bottom: none; border-left: none;
    transition: color var(--t);
    white-space: nowrap;
  }
  .search-cat-btn:hover { color: var(--fg); }
  .search-cat-btn .chev { margin-left: auto; transition: transform 0.2s var(--ease); }
  .search-cat-btn.open .chev { transform: rotate(180deg); }
  .search-field { flex: 1; display: flex; align-items: center; gap: 8px; padding: 0 14px; }
  .search-field svg { color: var(--g300); flex-shrink: 0; }
  .search-input {
    flex: 1; border: none; outline: none;
    font-size: 14.5px; color: var(--fg); background: transparent;
    font-family: var(--font); height: 54px; font-weight: 400;
  }
  .search-input::placeholder { color: var(--g300); }
  .search-btn {
    margin: 7px; padding: 0 22px; height: 40px; flex-shrink: 0;
    background: var(--fg); color: var(--white);
    border: none; border-radius: 7px;
    font-size: 13.5px; font-weight: 600; font-family: var(--font);
    display: flex; align-items: center; gap: 6px;
    transition: background var(--t);
    white-space: nowrap;
  }
  .search-btn:hover { background: var(--g800); }
  .search-btn svg { transition: transform 0.2s var(--ease); }
  .search-btn:hover svg { transform: translateX(2px); }

  .search-dd {
    position: absolute; top: calc(100% + 8px); left: 0;
    width: 220px; background: var(--white);
    border: 1px solid var(--g100); border-radius: 10px;
    overflow: hidden; z-index: 400;
    opacity: 0; transform: translateY(-5px);
    pointer-events: none;
    transition: opacity 0.15s, transform 0.15s;
  }
  .search-dd.open { opacity: 1; transform: translateY(0); pointer-events: all; }
  .search-dd-item {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 13px; font-size: 13px; font-weight: 500; color: var(--g600);
    border-bottom: 1px solid var(--g50); cursor: pointer;
    transition: background var(--t), color var(--t);
  }
  .search-dd-item:last-child { border-bottom: none; }
  .search-dd-item:hover { background: var(--g50); color: var(--fg); }
  .search-dd-item svg { color: var(--g400); transition: transform 0.2s var(--spring), color var(--t); }
  .search-dd-item:hover svg { transform: scale(1.2) rotate(-5deg); color: var(--fg); }

  .search-hints { display: flex; align-items: center; justify-content: center; gap: 6px; flex-wrap: wrap; }
  .hint-label { font-size: 12.5px; color: var(--g400); }
  .hint-tag {
    font-size: 12.5px; color: var(--g500); font-weight: 500;
    cursor: pointer; padding: 2px 0;
    border-bottom: 1px solid transparent;
    transition: color var(--t), border-color var(--t);
  }
  .hint-tag:hover { color: var(--fg); border-bottom-color: var(--fg); }
  .hint-sep { color: var(--g200); font-size: 12px; }

  .stats-bar {
    max-width: 580px; margin: 56px auto 0;
    display: flex; border: 1px solid var(--g100); border-radius: 12px;
    background: var(--white); overflow: hidden;
    animation: fadeUp 0.55s var(--ease) 0.32s both;
  }
  .stat { flex: 1; padding: 22px 20px; text-align: center; border-right: 1px solid var(--g100); }
  .stat:last-child { border-right: none; }
  .stat-n { font-size: 28px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; color: var(--fg); }
  .stat-l { font-size: 12px; color: var(--g400); margin-top: 5px; font-weight: 400; }

  .section { padding: 88px 28px; }
  .section-inner { max-width: 1280px; margin: 0 auto; }
  .section-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 36px; }
  .section-label { font-size: 11px; font-weight: 600; color: var(--g400); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
  .section-title { font-size: clamp(22px, 2.8vw, 34px); font-weight: 800; letter-spacing: -0.025em; line-height: 1.12; }
  .see-all-btn {
    display: flex; align-items: center; gap: 5px;
    font-size: 13.5px; font-weight: 500; color: var(--g500);
    background: none; border: none; white-space: nowrap; margin-bottom: 2px;
    transition: color var(--t);
  }
  .see-all-btn:hover { color: var(--fg); }
  .see-all-btn svg { transition: transform 0.2s var(--ease); }
  .see-all-btn:hover svg { transform: translateX(4px); }

  .pills-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: none; margin-bottom: 32px; }
  .pills-scroll::-webkit-scrollbar { display: none; }
  .pill {
    display: flex; align-items: center; gap: 7px; padding: 8px 18px;
    border: 1.5px solid var(--g200); border-radius: 100px;
    font-size: 13px; font-weight: 500; color: var(--g500);
    background: var(--white); white-space: nowrap; font-family: var(--font);
    transition: border-color var(--t), color var(--t), background var(--t);
  }
  .pill:hover { border-color: var(--g400); color: var(--fg); }
  .pill.active { border-color: var(--fg); color: var(--white); background: var(--fg); }
  .pill-icon { transition: transform 0.28s var(--spring); }
  .pill:hover .pill-icon { transform: scale(1.2) rotate(-8deg); }
  .pill.active .pill-icon { transform: none; }
  .pill-count { font-size: 11px; opacity: 0.6; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
  .card {
    background: var(--white); border: 1px solid var(--g100);
    border-radius: 12px; padding: 22px; cursor: pointer;
    position: relative; overflow: hidden;
    transition: border-color 0.22s var(--ease), transform 0.22s var(--ease);
  }
  .card-line {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: var(--fg);
    transform: scaleX(0); transform-origin: left;
    transition: transform 0.28s var(--ease);
  }
  .card:hover { border-color: var(--g300); transform: translateY(-2px); }
  .card:hover .card-line { transform: scaleX(1); }
  .card-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; }
  .card-icon {
    width: 42px; height: 42px; border: 1px solid var(--g100); border-radius: 9px;
    display: flex; align-items: center; justify-content: center; color: var(--g400);
    transition: border-color 0.22s, color 0.22s, transform 0.3s var(--spring);
  }
  .card:hover .card-icon { border-color: var(--fg); color: var(--fg); transform: rotate(-8deg) scale(1.12); }
  .price-badge {
    font-size: 12px; font-weight: 600; color: var(--g600);
    border: 1px solid var(--g100); border-radius: 6px;
    padding: 5px 10px; background: var(--g50); line-height: 1;
  }
  .price-type { font-size: 10px; color: var(--g400); font-weight: 400; display: block; margin-top: 2px; }
  .card-title { font-size: 15px; font-weight: 700; letter-spacing: -0.015em; margin-bottom: 5px; line-height: 1.25; }
  .card-provider { font-size: 13px; color: var(--g400); margin-bottom: 14px; }
  .card-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 16px; }
  .tag {
    font-size: 11px; padding: 3px 9px;
    border: 1px solid var(--g100); border-radius: 5px;
    color: var(--g500); font-weight: 500; background: var(--g50);
  }
  .card-foot { display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid var(--g50); }
  .rating { display: flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; }
  .rating svg { color: var(--fg); fill: var(--fg); }
  .rating-ct { color: var(--g400); font-weight: 400; font-size: 12px; }
  .location { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--g400); }

  .how-section { background: var(--g900); }
  .how-section .section-label { color: var(--g600); }
  .how-section .section-title { color: var(--white); }
  .steps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--g800); border-radius: 14px; overflow: hidden; border: 1px solid var(--g800); }
  .step-card { background: var(--g900); padding: 44px 36px; }
  .step-num { font-size: 11px; font-weight: 700; color: var(--g600); letter-spacing: 0.12em; margin-bottom: 28px; }
  .step-icon {
    width: 46px; height: 46px; border: 1px solid var(--g700); border-radius: 10px;
    display: flex; align-items: center; justify-content: center; color: var(--g500);
    margin-bottom: 22px;
    transition: border-color 0.22s, color 0.22s, transform 0.3s var(--spring);
  }
  .step-card:hover .step-icon { border-color: var(--g400); color: var(--white); transform: scale(1.1) rotate(6deg); }
  .step-title { font-size: 17px; font-weight: 700; color: var(--white); margin-bottom: 11px; letter-spacing: -0.015em; }
  .step-desc { font-size: 14px; color: var(--g500); line-height: 1.65; }

  .perks-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .perk-card {
    border: 1px solid var(--g100); border-radius: 12px; padding: 28px;
    background: var(--white); position: relative; overflow: hidden;
    transition: border-color 0.22s;
  }
  .perk-card:hover { border-color: var(--g300); }
  .perk-card::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 2px; background: var(--fg);
    transform: scaleY(0); transform-origin: top;
    transition: transform 0.3s var(--ease);
  }
  .perk-card:hover::before { transform: scaleY(1); }
  .perk-icon {
    width: 40px; height: 40px; border: 1px solid var(--g100); border-radius: 9px;
    display: flex; align-items: center; justify-content: center; color: var(--g500);
    margin-bottom: 18px;
    transition: border-color 0.22s, color 0.22s, transform 0.3s var(--spring);
  }
  .perk-card:hover .perk-icon { border-color: var(--g300); color: var(--fg); transform: scale(1.1); }
  .perk-title { font-size: 15px; font-weight: 700; margin-bottom: 8px; letter-spacing: -0.01em; }
  .perk-desc { font-size: 13.5px; color: var(--g500); line-height: 1.6; }

  .cta-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
    background: var(--g100); border: 1px solid var(--g100);
    border-radius: 16px; overflow: hidden;
  }
  .cta-panel { background: var(--white); padding: 52px 48px; }
  .cta-panel.dark { background: var(--g900); }
  .cta-kana { font-size: 44px; font-weight: 900; font-family: var(--font); margin-bottom: 12px; line-height: 1; letter-spacing: -0.06em; }
  .cta-panel .cta-kana { color: var(--g100); }
  .cta-panel.dark .cta-kana { color: var(--g700); }
  .cta-title { font-size: 24px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 12px; }
  .cta-panel .cta-title { color: var(--fg); }
  .cta-panel.dark .cta-title { color: var(--white); }
  .cta-desc { font-size: 14px; line-height: 1.65; max-width: 360px; margin-bottom: 28px; }
  .cta-panel .cta-desc { color: var(--g400); }
  .cta-panel.dark .cta-desc { color: var(--g500); }
  .cta-checks { display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
  .cta-check { display: flex; align-items: center; gap: 9px; font-size: 13.5px; font-weight: 500; }
  .cta-panel .cta-check { color: var(--g600); }
  .cta-panel.dark .cta-check { color: var(--g400); }
  .check-dot {
    width: 18px; height: 18px; border: 1px solid var(--g200); border-radius: 50%;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .cta-panel.dark .check-dot { border-color: var(--g700); }
  .btn-cta {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 26px; border-radius: 9px;
    font-size: 14px; font-weight: 700; font-family: var(--font);
    transition: all var(--t) var(--ease);
  }
  .btn-cta svg { transition: transform 0.2s var(--ease); }
  .btn-cta:hover svg { transform: translateX(3px); }
  .btn-cta-light { background: var(--fg); color: var(--white); border: 1.5px solid var(--fg); }
  .btn-cta-light:hover { background: var(--g800); border-color: var(--g800); }
  .btn-cta-dark { background: transparent; color: var(--white); border: 1.5px solid var(--g700); }
  .btn-cta-dark:hover { border-color: var(--g400); }

  .footer { border-top: 1px solid var(--g100); padding: 36px 28px; }
  .footer-inner { max-width: 1280px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .footer-logo { display: flex; align-items: center; gap: 8px; }
  .footer-logo-mark { width: 28px; height: 28px; border: 1.5px solid var(--g300); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 900; font-family: var(--font); color: var(--g400); }
  .footer-brand { font-size: 13px; font-weight: 600; color: var(--g500); }
  .footer-copy { font-size: 12.5px; color: var(--g400); }
  .footer-links { display: flex; gap: 20px; }
  .footer-link { font-size: 12.5px; color: var(--g400); transition: color var(--t); }
  .footer-link:hover { color: var(--fg); }

  .api-note {
    margin: -14px 0 20px;
    border: 1px solid var(--g100);
    border-radius: 8px;
    background: var(--white);
    color: var(--g500);
    padding: 10px 12px;
    font-size: 12.5px;
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 900px) {
    .steps-grid { grid-template-columns: 1fr; }
    .cta-grid { grid-template-columns: 1fr; }
    .perks-grid { grid-template-columns: 1fr; }
    .grid { grid-template-columns: 1fr; }
    .nav-links { display: none; }
    .mobile-menu-btn { display: flex; }
    .hero-katakana { display: none; }
    .footer-inner { flex-direction: column; align-items: flex-start; gap: 16px; }
  }
`;

type IconComponent = ElementType<{ size?: number; className?: string; color?: string }>;

type Category = {
  readonly id: string;
  readonly label: string;
  readonly Icon: IconComponent;
  readonly count: number | null;
  readonly description?: string | null;
};

type Perk = {
  readonly Icon: IconComponent;
  readonly title: string;
  readonly desc: string;
};

type StatsCounts = {
  readonly p: number;
  readonly l: number;
  readonly c: number;
};

type StepCardProps = {
  readonly num: string;
  readonly Icon: IconComponent;
  readonly title: string;
  readonly desc: string;
};

const FALLBACK_CATEGORIES: readonly Category[] = [
  { id: "all",  label: "Todos",         Icon: Zap,          count: null },
  { id: "ti",   label: "Tecnologia",    Icon: Monitor,      count: 1240 },
  { id: "design",  label: "Design",        Icon: Palette,      count: 890 },
  { id: "marketing",  label: "Marketing",     Icon: TrendingUp,   count: 670 },
  { id: "juridico",  label: "Jurídico",      Icon: Scale,        count: 430 },
  { id: "contabilidade",  label: "Contabilidade", Icon: Calculator,   count: 520 },
  { id: "construcao",  label: "Construção",    Icon: HardHat,      count: 380 },
  { id: "saude",  label: "Saúde",         Icon: Heart,        count: 290 },
  { id: "educacao",  label: "Educação",      Icon: BookOpen,     count: 640 },
  { id: "eventos",  label: "Eventos",       Icon: Camera,       count: 210 },
  { id: "beleza",  label: "Beleza",        Icon: Scissors,     count: 450 },
];

const PERKS: readonly Perk[] = [
  { Icon: Shield, title: "Contratos seguros", desc: "Formalize tudo dentro da plataforma. Proteja seu pagamento e seu trabalho com respaldo contratual." },
  { Icon: MessageSquare, title: "Chat integrado", desc: "Converse diretamente com o prestador antes e durante o projeto. Histórico sempre disponível." },
  { Icon: Star, title: "Avaliações reais", desc: "Só quem contratou pode avaliar. Ratings refletem a qualidade real do serviço prestado." },
];

const fmtCount = (n: number): string => n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);

function formatCurrency(value: number | null, currency = "BRL") {
  if (value === null) return "A negociar";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function priceTypeLabel(value: string) {
  return ({ fixed: "Fixo", hourly: "Por hora", daily: "Por dia", negotiable: "Negociável" } as Record<string, string>)[value] ?? value;
}

const iconByName: Record<string, IconComponent> = {
  monitor: Monitor,
  "pen-tool": Palette,
  "trending-up": TrendingUp,
  scale: Scale,
  calculator: Calculator,
  "hard-hat": HardHat,
  heart: Heart,
  "book-open": BookOpen,
  music: Camera,
  scissors: Scissors,
};

function toCategory(category: ApiCategory): Category {
  return {
    id: category.slug,
    label: category.name,
    Icon: category.icon ? iconByName[category.icon] ?? Zap : Zap,
    count: null,
    description: category.description,
  };
}

function ListingCard({ item }: { readonly item: ApiListing }) {
  const Icon = item.categoryIcon ? iconByName[item.categoryIcon] ?? Code : Code;
  return (
    <Link className="card" to="/anuncios/$listingId" params={{ listingId: item.id }}>
      <div className="card-line" />
      <div className="card-top">
        <div className="card-icon"><Icon size={18} /></div>
        <div className="price-badge">
          {formatCurrency(item.price, item.priceCurrency)}
          <span className="price-type">{priceTypeLabel(item.priceType)}</span>
        </div>
      </div>
      <div className="card-title">{item.title}</div>
      <div className="card-provider">{item.providerName}</div>
      <div className="card-tags">
        {item.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
      </div>
      <div className="card-foot">
        <div className="rating">
          <Star size={13} />
          {(item.providerRating ?? 0).toFixed(1)}
          <span className="rating-ct">({item.providerReviews ?? 0})</span>
        </div>
        <div className="location"><MapPin size={12} />{item.location ?? "Remoto"}</div>
      </div>
    </Link>
  );
}

function StepCard({ num, Icon, title, desc }: StepCardProps) {
  return (
    <div className="step-card">
      <div className="step-num">PASSO {num}</div>
      <div className="step-icon"><Icon size={20} /></div>
      <div className="step-title">{title}</div>
      <div className="step-desc">{desc}</div>
    </div>
  );
}

export default function BaitoApp() {
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });
  const [scrolled, setScrolled] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [searchCatOpen, setSearchCatOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [searchCat, setSearchCat] = useState("Categoria");
  const [counts, setCounts] = useState({ p: 0, l: 0, c: 0 });
  const statsRef = useRef<HTMLDivElement | null>(null);
  const animated = useRef(false);
  const listingsQuery = useQuery({
    queryKey: ["listings", activeCat],
    queryFn: () => listListings({ category: activeCat, perPage: 6 }),
  });
  const providersQuery = useQuery({
    queryKey: ["providers", "landing"],
    queryFn: () => listProviders({ perPage: 6 }),
  });
  const userToken = getUserToken();
  const adminToken = getAdminToken();
  const meQuery = useQuery({
    queryKey: ["me", userToken],
    queryFn: () => getMe(userToken ?? ""),
    enabled: Boolean(userToken),
  });
  const role = meQuery.data?.data.role;
  const isProvider = role === "provider";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const animateCounts = useCallback(() => {
    if (animated.current) return;
    animated.current = true;
    const T: StatsCounts = { p: providersQuery.data?.meta.total ?? 0, l: listingsQuery.data?.meta.total ?? 0, c: 4 };
    const dur = 1800;
    const start = performance.now();
    const tick = (now: number): void => {
      const prog = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setCounts({ p: Math.floor(T.p * ease), l: Math.floor(T.l * ease), c: Math.floor(T.c * ease) });
      if (prog < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [listingsQuery.data?.meta.total, providersQuery.data?.meta.total]);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) animateCounts(); }, { threshold: 0.4 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [animateCounts]);

  const categories: readonly Category[] = categoriesQuery.data?.data.length
    ? [{ id: "all", label: "Todos", Icon: Zap, count: null }, ...categoriesQuery.data.data.map(toCategory)]
    : FALLBACK_CATEGORIES;
  const visible = listingsQuery.data?.data ?? [];

  return (
    <>
      <style>{CSS}</style>

      <nav className={`nav${scrolled ? " scrolled" : ""}`}>
        <div className="nav-inner">
          <a className="logo" href="/">
            <div className="logo-mark">バ</div>
            <div className="logo-wordmark">
              <span className="logo-name">baito</span>
              <span className="logo-tagline">バイト</span>
            </div>
          </a>

          <div className="nav-links">
            <div className="dd-wrap">
              <button type="button" className={`nav-link${ddOpen ? " open" : ""}`} onClick={() => setDdOpen(v => !v)} onBlur={() => setTimeout(() => setDdOpen(false), 150)}>
                Serviços
                <ChevronDown size={14} className="chev" />
              </button>
              <div className={`dd${ddOpen ? " open" : ""}`}>
                {categories.filter(c => c.id !== "all").slice(0, 6).map(({ id, label, Icon, count }) => (
                  <div key={id} className="dd-row" onClick={() => { setActiveCat(id); setDdOpen(false); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                    <div className="dd-icon"><Icon size={14} /></div>
                    {label}
                    <span className="dd-count">{count?.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
            {userToken ? (
              <>
                <Link to="/prestadores" className="nav-link">Buscar prestadores</Link>
                <Link to={isProvider ? "/dashboard/prestador" : "/dashboard/cliente"} className="nav-link">Meu perfil</Link>
                {isProvider && <Link to="/dashboard/prestador" className="nav-link">Minhas ofertas</Link>}
              </>
            ) : (
              <>
                <a href="#como-funciona" className="nav-link">Como funciona</a>
                <a href="#prestadores" className="nav-link">Para prestadores</a>
              </>
            )}
          </div>

          <div className="nav-auth">
            {userToken ? (
              <>
                <Link to={isProvider ? "/dashboard/prestador" : "/dashboard/cliente"} className="btn-ghost-sm">Meu perfil</Link>
                <button type="button" className="btn-solid-sm" onClick={() => { clearUserSession(); window.location.href = "/"; }}>Sair</button>
              </>
            ) : (
              <>
                {adminToken && <Link to="/admin" className="btn-ghost-sm">Painel admin</Link>}
                <Link to="/entrar" className="btn-ghost-sm">Entrar</Link>
                <Link to="/cadastro" className="btn-solid-sm">Cadastrar</Link>
              </>
            )}
          </div>
          <button type="button" className="mobile-menu-btn"><Menu size={20} /></button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-grid" />
        <div className="hero-katakana" aria-hidden="true">バイト</div>
        <div className="hero-inner">
          <div className="hero-pill">
            <div className="hero-pill-dot"><span>バ</span></div>
            Marketplace de serviços profissionais
          </div>
          <h1 className="hero-h1">
            Encontre o serviço<br />
            <span className="underline">certo para você.</span>
          </h1>
          <p className="hero-sub">
            Conecte-se a prestadores verificados, formalize contratos e gerencie tudo em um só lugar.
          </p>

          <div className="search-wrap">
            <div className={`search-bar${searchFocused ? " focused" : ""}`}>
              <div style={{ position: "relative" }}>
                <button type="button" className={`search-cat-btn${searchCatOpen ? " open" : ""}`} onClick={() => setSearchCatOpen(v => !v)} onBlur={() => setTimeout(() => setSearchCatOpen(false), 150)}>
                  {searchCat}
                  <ChevronDown size={14} className="chev" />
                </button>
                <div className={`search-dd${searchCatOpen ? " open" : ""}`}>
                  {categories.map(({ id, label, Icon }) => (
                    <div key={id} className="search-dd-item" onClick={() => { setSearchCat(label); setActiveCat(id); setSearchCatOpen(false); }}>
                      <Icon size={14} />{label}
                    </div>
                  ))}
                </div>
              </div>
              <div className="search-field">
                <Search size={16} />
                <input className="search-input" placeholder="Ex: desenvolvedor React, designer de logotipo..." onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
              </div>
              <Link to="/prestadores" className="search-btn">
                Buscar <ArrowRight size={15} />
              </Link>
            </div>
            <div className="search-hints">
              <span className="hint-label">Popular:</span>
              {["Design de logo", "Desenvolvimento web", "Consultoria jurídica", "Marketing digital"].map((h, i, arr) => (
                <span key={h}>
                  <span className="hint-tag">{h}</span>
                  {i < arr.length - 1 && <span className="hint-sep">·</span>}
                </span>
              ))}
            </div>
          </div>

          <div className="stats-bar" ref={statsRef}>
            <div className="stat">
              <div className="stat-n">{fmtCount(counts.p)}</div>
              <div className="stat-l">Prestadores ativos</div>
            </div>
            <div className="stat">
              <div className="stat-n">{fmtCount(counts.l)}</div>
              <div className="stat-l">Anúncios publicados</div>
            </div>
            <div className="stat">
              <div className="stat-n">{fmtCount(counts.c)}</div>
              <div className="stat-l">Contratos realizados</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="listings" style={{ background: "var(--bg)" }}>
        <div className="section-inner">
          <div className="section-head">
            <div>
              <div className="section-label">Em destaque</div>
              <div className="section-title">Serviços disponíveis</div>
            </div>
            <button type="button" className="see-all-btn">Ver todos <ArrowRight size={15} /></button>
          </div>

          <div className="pills-scroll">
            {categoriesQuery.isError && (
              <div className="api-note">Não foi possível carregar categorias da API.</div>
            )}
            {categories.map(({ id, label, Icon, count }) => (
              <button key={id} className={`pill${activeCat === id ? " active" : ""}`} onClick={() => setActiveCat(id)}>
                <span className="pill-icon"><Icon size={13} /></span>
                {label}
                {count && activeCat !== id && <span className="pill-count">{count.toLocaleString()}</span>}
              </button>
            ))}
          </div>

          <div className="grid">
            {listingsQuery.isLoading && <div className="api-note">Carregando serviços reais do backend...</div>}
            {visible.map(item => <ListingCard key={item.id} item={item} />)}
            {!listingsQuery.isLoading && visible.length === 0 && <div className="api-note">Nenhum serviço encontrado para esta categoria.</div>}
          </div>
        </div>
      </section>

      <section className="section how-section" id="como-funciona">
        <div className="section-inner">
          <div style={{ marginBottom: 52 }}>
            <div className="section-label">Simples assim</div>
            <div className="section-title">Como o baito funciona</div>
          </div>
          <div className="steps-grid">
            <StepCard num="01" Icon={Search} title="Encontre o serviço" desc="Busque por categoria, localização ou palavra-chave. Filtre por avaliação, preço e disponibilidade." />
            <StepCard num="02" Icon={MessageSquare} title="Fale com o prestador" desc="Envie mensagens, tire dúvidas e acerte todos os detalhes antes de fechar qualquer acordo." />
            <StepCard num="03" Icon={Shield} title="Contrate com segurança" desc="Formalize o contrato na plataforma, acompanhe o andamento e avalie ao final do serviço." />
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--white)" }}>
        <div className="section-inner">
          <div className="section-head">
            <div>
              <div className="section-label">Por que usar o baito</div>
              <div className="section-title">Mais do que um marketplace</div>
            </div>
          </div>
          <div className="perks-grid">
            {PERKS.map(({ Icon, title, desc }) => (
              <div key={title} className="perk-card">
                <div className="perk-icon"><Icon size={18} /></div>
                <div className="perk-title">{title}</div>
                <div className="perk-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="prestadores">
        <div className="section-inner">
          <div className="cta-grid">
            <div className="cta-panel">
              <div className="cta-kana" aria-hidden="true">バ</div>
              <div className="cta-title">Sou cliente</div>
              <div className="cta-desc">Encontre o profissional ideal para o seu projeto com total transparência e segurança.</div>
              <div className="cta-checks">
                {["Acesso a milhares de perfis verificados", "Contratação formalizada na plataforma", "Chat e histórico de mensagens integrados"].map(t => (
                  <div key={t} className="cta-check">
                    <div className="check-dot"><Check size={10} color="var(--g600)" /></div>
                    {t}
                  </div>
                ))}
              </div>
              <Link to="/prestadores" className="btn-cta btn-cta-light">Buscar serviços <ArrowRight size={16} /></Link>
            </div>

            <div className="cta-panel dark">
              <div className="cta-kana" aria-hidden="true">バ</div>
              <div className="cta-title">Sou prestador</div>
              <div className="cta-desc">Publique seus serviços, gerencie contratos e construa sua reputação em uma plataforma feita para profissionais.</div>
              <div className="cta-checks">
                {["Perfil completo com portfólio e avaliações", "Anúncios ilimitados por categoria", "Gestão de contratos e mensagens em um lugar"].map(t => (
                  <div key={t} className="cta-check">
                    <div className="check-dot" style={{ borderColor: "var(--g700)" }}><Check size={10} color="var(--g500)" /></div>
                    {t}
                  </div>
                ))}
              </div>
              <Link to="/cadastro" className="btn-cta btn-cta-dark">Criar meu perfil <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-logo">
            <div className="footer-logo-mark">バ</div>
            <span className="footer-brand">baito</span>
          </div>
          <div className="footer-copy">© 2025 Baito Tecnologia Ltda.</div>
          <div className="footer-links">
            {["Termos", "Privacidade", "Suporte", "Blog"].map(l => (
              <a key={l} href="#" className="footer-link">{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
