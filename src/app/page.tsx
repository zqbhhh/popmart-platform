"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- 工具函数：时间戳格式化 ---
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
  return `${past.getMonth() + 1}-${past.getDate()} ${past.getHours()}:${past.getMinutes().toString().padStart(2, '0')}`;
};

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
  // --- UI 状态 ---
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [showOnlyMine, setShowOnlyMine] = useState(false);
  const [searchStore, setSearchStore] = useState(''); 
  const [searchItem, setSearchItem] = useState('');   
  const [filterType, setFilterType] = useState('all'); 
  const [formData, setFormData] = useState({ 
    price: '', shop: '', item: '', contact: '', 
    expiryType: 'today', customDate: '' 
  });

  // --- 🔒 安全核心：初始化设备指纹 ---
  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('device_fingerprint')) {
      const fingerprint = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('device_fingerprint', fingerprint);
    }
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
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
      const channel = supabase.channel('realtime_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, hasAgreed]);

  const handlePublish = async () => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('请填写完整信息');
    setLoading(true);
    
    const getExpiryDate = () => {
        const d = new Date();
        if (formData.expiryType === 'today') d.setHours(23, 59, 59);
        else if (formData.expiryType === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(23, 59, 59); }
        else if (formData.customDate) return new Date(formData.customDate + "T23:59:59");
        return d;
    };

    const { error } = await supabase.from('posts').insert([{ 
      ...formData, 
      type: activeTab,
      user_phone: phone,
      // 关键：存入当前设备的唯一标识
      device_token: localStorage.getItem('device_fingerprint'),
      expires_at: getExpiryDate().toISOString(),
      price: parseFloat(formData.price) 
    }]);

    if (error) alert('发布失败，请检查数据库字段是否包含 device_token');
    else {
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
      alert('发布成功！');
      fetchPosts();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要撤回这条发布信息吗？')) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) alert('删除失败');
      else fetchPosts();
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false); setHasAgreed(false); setPhone('');
  };

  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
    .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()))
    .filter(p => showOnlyMine ? p.user_phone === phone : true);

  // 1. 登录页 & 2. 免责声明 (代码同前，略过以节省空间，保持逻辑完整)
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7]">
        <div className="w-full max-w-sm bg-white p-10 rounded-3xl shadow-sm text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">专注 <span className="text-[#E60012]">自提</span></h1>
            <p className="text-sm text-gray-500">泡泡玛特自提实时信息交流站</p>
          </div>
          <div className="space-y-4">
            <input type="text" placeholder="请输入手机号登录" className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-center outline-none focus:border-[#2D63FF]" value={phone} onChange={e => setPhone(e.target.value)} />
            <button onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('请输入11位手机号')} className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold shadow-md">即刻进入</button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn && !hasAgreed) {
    return (
        <div className="fixed inset-0 bg-white flex items-center justify-center z-50 p-6">
            <div className="max-w-md w-full space-y-6">
                <h2 className="text-2xl font-bold text-center">用户须知与声明</h2>
                <div className="text-sm text-gray-600 bg-gray-50 p-6 rounded-2xl space-y-4">
                    <p>1. 本平台仅供玩家信息交流。</p>
                    <p>2. 请确保您的操作符合平台规范。</p>
                    <p>3. 系统会自动绑定您的发布设备，防止信息被他人恶意删除。</p>
                </div>
                <button onClick={() => setHasAgreed(true)} className="w-full bg-[#E60012] text-white py-4 rounded-xl font-bold">同意并进入</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-16">
      <div className="h-2 bg-[#E60012] w-full"></div>
      <header className="bg-white px-6 py-4 shadow-sm flex justify-between items-center max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold">专注 <span className="text-[#E60012]">自提</span></h1>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold bg-gray-100 px-3 py-1 rounded-full">{phone.slice(0,3)}****{phone.slice(-4)}</span>
          <button onClick={handleLogout} className="text-xs text-[#E60012]">退出</button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* 发布面板 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b text-center font-bold">
            <button onClick={() => setActiveTab('sell')} className={`flex-1 py-4 ${activeTab === 'sell' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>出售自提码</button>
            <button onClick={() => setActiveTab('buy')} className={`flex-1 py-4 ${activeTab === 'buy' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>求购自提码</button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="价格 (元)" className="p-3 bg-gray-50 border rounded-lg outline-none focus:border-[#2D63FF]" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} type="number"/>
              <input placeholder="门店名称" className="p-3 bg-gray-50 border rounded-lg outline-none focus:border-[#2D63FF]" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              <input placeholder="商品名称" className="p-3 bg-gray-50 border rounded-lg outline-none focus:border-[#2D63FF]" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              <input placeholder="微信号 (仅复制可见)" className="p-3 bg-gray-50 border rounded-lg outline-none focus:border-[#2D63FF]" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
            </div>
            <div className="flex flex-wrap gap-2 items-center text-sm">
                <span className="text-gray-400">有效期:</span>
                {['today', 'tomorrow', 'custom'].map(t => (
                    <button key={t} onClick={() => setFormData({...formData, expiryType: t})} className={`px-3 py-1.5 rounded-md border ${formData.expiryType === t ? 'bg-[#2D63FF] text-white' : 'bg-white'}`}>
                        {t === 'today' ? '今天' : t === 'tomorrow' ? '明天' : '自选'}
                    </button>
                ))}
                {formData.expiryType === 'custom' && <input type="date" className="border p-1 rounded" onChange={e => setFormData({...formData, customDate: e.target.value})} />}
            </div>
            <button onClick={handlePublish} disabled={loading} className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold shadow-md active:scale-95 transition-all">
              {loading ? '发布中...' : '立即发布'}
            </button>
          </div>
        </section>

        {/* 实时大厅 */}
        <section className="space-y-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold flex items-center gap-2"><span className="w-1.5 h-5 bg-[#E60012] rounded-full"></span>实时大厅</h2>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1 rounded-full border shadow-sm">
                <input type="checkbox" className="accent-[#2D63FF]" checked={showOnlyMine} onChange={e => setShowOnlyMine(e.target.checked)} />
                <span className="text-xs font-bold text-gray-600">只看我的发布</span>
              </label>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                  <select className="border bg-gray-50 rounded-lg px-2 py-2 text-sm outline-none" onChange={e=>setFilterType(e.target.value)}>
                      <option value="all">全部</option><option value="sell">出售</option><option value="buy">求购</option>
                  </select>
                  <input placeholder="🔍 搜门店" className="flex-1 px-4 py-2 rounded-lg border bg-gray-50 text-sm outline-none" value={searchStore} onChange={e => setSearchStore(e.target.value)} />
                  <input placeholder="🔍 搜商品" className="flex-1 px-4 py-2 rounded-lg border bg-gray-50 text-sm outline-none" value={searchItem} onChange={e => setSearchItem(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-gray-400 font-bold uppercase">Hot:</span>
                {['静安大悦城', 'LABUBU', '心动马卡龙'].map(tag => (
                  <button key={tag} onClick={() => tag.length > 4 ? setSearchStore(tag) : setSearchItem(tag)} className="text-[10px] bg-blue-50 text-[#2D63FF] px-2 py-1 rounded font-bold uppercase">{tag}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border min-h-[300px] p-2 shadow-sm">
            {isFetching ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse"></div>)}
              </div>
            ) : displayPosts.length > 0 ? (
              <div className="space-y-2">
                {displayPosts.map(post => {
                  // 🔒 权限判断：手机号匹配 且 设备指纹匹配
                  const canDelete = post.user_phone === phone && post.device_token === (typeof window !== 'undefined' ? localStorage.getItem('device_fingerprint') : null);

                  return (
                    <div key={post.id} className="relative p-4 border border-gray-50 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30 hover:bg-white transition-all">
                      <div className="absolute top-2 right-4 text-[10px] text-gray-400">{formatTimeAgo(post.created_at)}</div>
                      <div className="flex-1 flex gap-3 items-center w-full mt-2 sm:mt-0">
                        <div className={`px-2 py-1 rounded text-[9px] font-black ${post.type === 'sell' ? 'bg-red-100 text-[#E60012]' : 'bg-blue-100 text-[#2D63FF]'}`}>{post.type === 'sell' ? 'SELL' : 'BUY'}</div>
                        <div className="overflow-hidden">
                          <h4 className="font-bold text-sm truncate pr-12">{post.shop}</h4>
                          <p className="text-[11px] text-gray-500 truncate">{post.item}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between shrink-0">
                        <span className="text-lg font-black text-[#E60012]">￥{post.price}</span>
                        <div className="flex items-center gap-2">
                            <button onClick={() => {navigator.clipboard.writeText(post.contact); alert('微信号已复制');}} className="bg-[#2D63FF] text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-sm">复制微信</button>
                            {canDelete && (
                                <button onClick={() => handleDelete(post.id)} className="text-gray-300 hover:text-red-500 p-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-gray-300"><p className="text-sm">没有找到相关信息</p></div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
