-- Ad Trend Radar 账号体系：用户表 + 用量流水表
-- 在 Supabase Dashboard → SQL Editor 里整段粘贴执行一次即可。
-- 后端只用 service_role key 访问（服务端），因此无需配置 RLS 策略。

create extension if not exists pgcrypto;

create table if not exists atr_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  password_hash text not null,          -- 格式：scryptSalt:hash
  created_at    timestamptz not null default now()
);

create table if not exists atr_usage_events (
  id         bigserial primary key,
  user_id    uuid not null references atr_users(id) on delete cascade,
  day        text not null,             -- 配额自然日（默认按 Asia/Shanghai 切日）
  action     text not null,             -- intel / llm / generate-image / youtube-brief
  created_at timestamptz not null default now()
);

create index if not exists atr_usage_user_day_idx on atr_usage_events (user_id, day);

-- 可选：想看用量概览时执行
-- select u.email, count(e.id) as today_used
-- from atr_users u
-- left join atr_usage_events e on e.user_id = u.id and e.day = (now() at time zone 'Asia/Shanghai')::date::text
-- group by u.email order by today_used desc;
