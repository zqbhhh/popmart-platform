"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const formatTimeAgo = (dateString: string) => {
  if (!dateString) return '';
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '刚刚发布';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  return `${past.getMonth() + 1}-${past.getDate()}`;
};

const formatExpiryLabel = (dateString: string) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  return `${d.getMonth() + 1}/${d.getDate()} 23:00`;
};

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  // --- UI & 排序状态 ---
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priceAsc' | 'priceDesc'>('newest'); // 新增排序状态
  const menuRef = useRef<HTMLDivElement>(null);

  // --- 搜索状态 ---
  const [searchStore, setSearchStore] = useState('');
  const [searchItem, setSearchItem] = useState('');
  const [filterType, setFilterType] = useState('all');

  const [formData, setFormData] = useState({
    price: '', shop: '', item: '', contact: '',
    expiryType: 'today', customDate: ''
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('device_fingerprint')) {
      const fingerprint = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('device_fingerprint', fingerprint);
    }
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (data) {
        const now = new Date();
        const validPosts = data.filter(post => !post.expires_at || new Date(post.expires_at) > now);
        setPosts(validPosts);
      }
    } catch (err) { console.error(err); } finally { setIsFetching(false); }
  };

  useEffect(() => {
    if (isLoggedIn && hasAgreed) {
      setIsFetching(true);
      fetchPosts();
      const channel = supabase.channel('realtime_posts').on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts()).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, hasAgreed]);

  const handlePublish = async () => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('请填写完整信息');
    setLoading(true);
    const getExpiryDate = () => {
      const d = new Date();
      if (formData.expiryType === 'today') d.setHours(23, 0, 0, 0);
      else if (formData.expiryType === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(23, 0, 0, 0); }
      else if (formData.customDate) return new Date(`${formData.customDate}T23:00:00`);
      return d;
    };
    const { error } = await supabase.from('posts').insert([{
      ...formData, type: activeTab, user_phone: phone,
      device_token: localStorage.getItem('device_fingerprint'),
      expires_at: getExpiryDate().toISOString(), price: parseFloat(formData.price)
    }]);
    if (error) alert('发布失败');
    else {
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
      alert('发布成功！统一23:00下架');
      fetchPosts();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要撤回吗？')) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (!error) fetchPosts();
    }
  };

  // --- 综合过滤与排序引擎 ---
  const displayPosts = useMemo(() => {
    let result = posts
      .filter(p => (filterType === 'all' || p.type === filterType))
      .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
      .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()))
      .filter(p => showOnlyMine ? p.user_phone === phone : true);

    return result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortBy === 'priceAsc') return a.price - b.price;
      if (sortBy === 'priceDesc') return b.price - a.price;
      return 0;
    });
  }, [posts, filterType, searchStore, searchItem, showOnlyMine, sortBy, phone]);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7]">
        <div className="w-full max-w-sm bg-white p-10 rounded-3xl shadow-sm text-center space-y-8">
            <h1 className="text-3xl font-bold">专注 <span className="text-[#E60012]">自提</span></h1>
            <input type="text" placeholder="请输入手机号" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-center outline-none" value={phone} onChange={e => setPhone(e.target.value)} />
            <button onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('请输入11位手机号')} className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold shadow-md">即刻进入</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-16">
      <div className="h-2 bg-[#E60012] w-full"></div>

      <header className="bg-white px-6 py-4 shadow-sm flex justify-between items-center max-w-5xl mx-auto sticky top-0 z-40">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight">专注 <span className="text-[#E60012]">自提</span></h1>
        </div>
        <div className="relative" ref={menuRef}>
          <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex items-center border border-gray-100 rounded-full pl-2 pr-4 py-1.5 shadow-sm bg-gray-50 cursor-pointer">
            <div className="w-7 h-7 bg-[#2D63FF] rounded-full mr-2 flex items-center justify-center text-white text-[10px] font-bold">PRO</div>
            <span className="text-xs font-bold">{phone.slice(-4)} 账户 ▼</span>
          </div>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
              <button onClick={() => { setShowOnlyMine(!showOnlyMine); setIsMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-blue-50">
                {showOnlyMine ? "显示全部发布" : "管理我的发布"}
              </button>
              <button onClick={() => { setIsLoggedIn(false); setHasAgreed(false); }} className="w-full text-left px-4 py-3 text-sm text-red-500 hover:bg-red-50">退出登录</button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* 发布面板略... (保持原逻辑) */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100 text-base font-bold text-center">
            <button onClick={() => setActiveTab('sell')} className={`flex-1 py-4 ${activeTab === 'sell' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>出售</button>
            <button onClick={() => setActiveTab('buy')} className={`flex-1 py-4 ${activeTab === 'buy' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>求购</button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="价格" className="p-3 bg-gray-50 rounded-lg outline-none text-sm" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} type="number"/>
              <input placeholder="门店名称" className="p-3 bg-gray-50 rounded-lg outline-none text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              <input placeholder="商品名称" className="p-3 bg-gray-50 rounded-lg outline-none text-sm col-span-2" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              <input placeholder="微信号" className="p-3 bg-gray-50 rounded-lg outline-none text-sm col-span-2" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
            </div>
            <div className="flex gap-2">
              {['today', 'tomorrow', 'custom'].map(t => (
                <button key={t} onClick={() => setFormData({...formData, expiryType: t as any})} className={`px-3 py-1.5 rounded-md text-xs border ${formData.expiryType === t ? 'bg-[#2D63FF] text-white' : 'bg-white text-gray-500'}`}>
                  {t === 'today' ? '今天' : t === 'tomorrow' ? '明天' : '自选'}
                </button>
              ))}
            </div>
            <button onClick={handlePublish} disabled={loading} className="w-full bg-[#2D63FF] text-white py-3 rounded-xl font-bold">立即发布</button>
          </div>
        </section>

        {/* 实时大厅与排序功能 */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="w-1.5 h-5 bg-[#E60012] rounded-full"></span> 实时大厅
            </h2>
            
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <input placeholder="🔍 搜门店" className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 outline-none text-sm focus:border-[#2D63FF]" value={searchStore} onChange={e => setSearchStore(e.target.value)} />
                <input placeholder="🔍 搜商品" className="flex-1 px-4 py-2 rounded-xl border border-gray-100 bg-gray-50 outline-none text-sm focus:border-[#2D63FF]" value={searchItem} onChange={e => setSearchItem(e.target.value)} />
              </div>
              
              {/* --- 新增排序控制条 --- */}
              <div className="flex items-center justify-between border-t pt-3">
                <div className="flex gap-2">
                    <select className="text-xs border-none bg-gray-100 rounded-md px-2 py-1 outline-none" value={sortBy} onChange={e => setSortBy(e.target.value as any)}>
                        <option value="newest">⏰ 最新发布</option>
                        <option value="oldest">⏰ 最旧发布</option>
                        <option value="priceAsc">💰 价格：低到高</option>
                        <option value="priceDesc">💰 价格：高到低</option>
                    </select>
                    <select className="text-xs border-none bg-gray-100 rounded-md px-2 py-1 outline-none" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">全部类型</option>
                        <option value="sell">只看卖</option>
                        <option value="buy">只看买</option>
                    </select>
                </div>
                <span className="text-[10px] text-gray-400">共 {displayPosts.length} 条信息</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {isFetching ? (
              <div className="text-center py-10 text-gray-400">加载中...</div>
            ) : displayPosts.map(post => {
              const canDelete = post.user_phone === phone && post.device_token === (typeof window !== 'undefined' ? localStorage.getItem('device_fingerprint') : null);

              return (
                <div key={post.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                  {/* 第一行：元数据（时间与到期），解决重叠问题 */}
                  <div className="flex justify-between items-center text-[10px] pb-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${post.type === 'sell' ? 'bg-red-50 text-[#E60012]' : 'bg-blue-50 text-[#2D63FF]'}`}>
                        {post.type === 'sell' ? '出售' : '求购'}
                      </span>
                      <span className="text-gray-400">{formatTimeAgo(post.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400">有效期至:</span>
                      <span className="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded">
                        {formatExpiryLabel(post.expires_at)}
                      </span>
                    </div>
                  </div>

                  {/* 第二行：核心内容 */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="font-bold text-gray-900 truncate">{post.shop}</h4>
                      <p className="text-xs text-gray-500 truncate">{post.item}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-[#E60012]">￥{post.price}</span>
                    </div>
                  </div>
                  
                  {/* 第三行：操作区 */}
                  <div className="flex justify-between items-center">
                    <div className="text-[10px] text-gray-300">
                      ID: {post.id.slice(0,8)}
                    </div>
                    <div className="flex items-center gap-3">
                      {canDelete && (
                        <button onClick={() => handleDelete(post.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      )}
                      <button onClick={() => {
                        navigator.clipboard.writeText(post.contact); 
                        alert('✅ 微信号已复制！');
                      }} className="bg-[#2D63FF] text-white px-6 py-2 rounded-xl text-sm font-bold shadow-sm active:scale-95 transition-all">
                        复制微信
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <footer className="text-center py-8 text-[10px] text-gray-400">© 2026 专注自提 · 实时交易交流</footer>
    </div>
  );
}
