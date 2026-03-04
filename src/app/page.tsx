"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- 工具函数：时间格式化 ---
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

// 格式化过期时间显示
const formatExpiry = (dateString: string) => {
  const d = new Date(dateString);
  return `${d.getMonth() + 1}月${d.getDate()}日 23:00`;
};

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false); // 控制右上角个人菜单

  // --- UI 状态 ---
  const [activeTab, setActiveTab] = useState<'sell' | 'buy'>('sell');
  const [showOnlyMine, setShowOnlyMine] = useState(false);

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
  }, []);

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        const now = new Date();
        // 信息过期后，自动过滤不显示（达到自动删除效果）
        const validPosts = data.filter(post => !post.expires_at || new Date(post.expires_at) > now);
        setPosts(validPosts);
      }
    } catch (err) { 
      console.error(err); 
    } finally {
      setIsFetching(false);
    }
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
    if (formData.expiryType === 'custom' && !formData.customDate) return alert('请选择自定义截止日期');

    setLoading(true);
    
    // 修改b：过期时间统一为23点
    const getExpiryDate = () => {
        const d = new Date();
        d.setHours(23, 0, 0, 0); // 设为 23:00:00
        if (formData.expiryType === 'tomorrow') {
            d.setDate(d.getDate() + 1);
        } else if (formData.expiryType === 'custom' && formData.customDate) {
            const [y, m, day] = formData.customDate.split('-').map(Number);
            d.setFullYear(y, m - 1, day);
        }
        return d;
    };

    const { error } = await supabase.from('posts').insert([{ 
      ...formData, 
      type: activeTab,
      user_phone: phone,
      device_token: localStorage.getItem('device_fingerprint'),
      expires_at: getExpiryDate().toISOString(),
      price: parseFloat(formData.price) 
    }]);

    if (error) alert('发布失败');
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
    setIsLoggedIn(false);
    setHasAgreed(false);
    setPhone('');
    setShowUserMenu(false);
  };

  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
    .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()))
    .filter(p => showOnlyMine ? p.user_phone === phone : true);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#F5F5F7]">
        <div className="w-full max-w-sm bg-white p-10 rounded-3xl shadow-sm text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">专注 <span className="text-[#E60012]">自提</span></h1>
            <p className="text-sm text-gray-500">泡泡玛特自提实时信息交流站</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" placeholder="请输入手机号登录" 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-xl text-center outline-none focus:border-[#2D63FF] transition-all"
              value={phone} onChange={e => setPhone(e.target.value)}
            />
            <button 
              onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('请输入11位手机号')} 
              className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold active:scale-95 transition-transform shadow-md"
            >即刻进入</button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoggedIn && !hasAgreed) {
    return (
        <div className="fixed inset-0 bg-white flex items-center justify-center z-50 p-6 overflow-y-auto">
            <div className="max-w-md w-full space-y-6 my-auto">
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-bold text-gray-900">用户须知与声明</h2>
                  <p className="text-sm text-gray-500">为了您的安全，请仔细阅读</p>
                </div>
                <div className="text-[14px] text-gray-600 leading-relaxed space-y-4 bg-gray-50 p-6 rounded-2xl">
                    <p><strong>1. 信息中转站：</strong>本平台仅为玩家提供自提码信息发布空间。</p>
                    <p><strong>2. 风险自担：</strong>交易双方应自行承担风险。建议核实对方真实性。</p>
                    <p><strong>3. 隐私保护：</strong>发布时会自动绑定设备，确保信息仅能由发布者本人撤回。</p>
                </div>
                <button 
                  onClick={() => setHasAgreed(true)} 
                  className="w-full bg-[#E60012] text-white py-4 rounded-xl font-bold active:scale-95 transition-all shadow-md"
                >我已阅读并同意</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-gray-900 pb-16">
      <div className="h-2 bg-[#E60012] w-full"></div>

      {/* 修改c：右上角个人中心菜单 */}
      <header className="bg-white px-6 py-4 shadow-sm flex justify-between items-center max-w-5xl mx-auto sticky top-0 z-40">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">专注 <span className="text-[#E60012]">自提</span></h1>
          <span className="text-xs text-gray-400">实时信息交流站</span>
        </div>
        
        <div className="relative">
          <div 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center border border-gray-100 rounded-full pl-2 pr-4 py-1.5 shadow-sm bg-gray-50 cursor-pointer hover:bg-gray-100 transition-all"
          >
            <div className="w-8 h-8 bg-[#2D63FF] rounded-full mr-3 flex items-center justify-center text-white text-[10px] font-bold">个人</div>
            <span className="text-xs font-bold">{phone.slice(0,3)}****{phone.slice(-4)}</span>
          </div>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl z-50 overflow-hidden">
              <button 
                onClick={() => { setShowOnlyMine(!showOnlyMine); setShowUserMenu(false); }}
                className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 hover:bg-gray-50 ${showOnlyMine ? 'text-[#2D63FF] font-bold' : 'text-gray-700'}`}
              >
                {showOnlyMine ? '显示全部信息' : '管理/删除我的发布'}
              </button>
              <button 
                onClick={handleLogout}
                className="w-full text-left px-4 py-3 text-sm text-[#E60012] hover:bg-red-50 border-t border-gray-50"
              >
                退出登录
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* 发布面板 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100 text-lg font-bold text-center">
            <button onClick={() => setActiveTab('sell')} className={`flex-1 py-5 transition-colors ${activeTab === 'sell' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>出售自提码</button>
            <button onClick={() => setActiveTab('buy')} className={`flex-1 py-5 transition-colors ${activeTab === 'buy' ? 'text-[#2D63FF] bg-blue-50/20' : 'text-gray-300'}`}>求购自提码</button>
          </div>

          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs text-gray-500">标明价格 (元)</label>
                <input placeholder="例如：534" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm font-bold text-[#E60012]" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} type="number"/>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">门店全名</label>
                <input placeholder="例如：上海北外滩来福士店" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">商品全名</label>
                <input placeholder="例如：Molly毛绒挂件" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-gray-500">个人微信号</label>
                <input placeholder="仅复制可见" className="w-full p-3.5 bg-gray-50 border border-gray-100 rounded-lg outline-none focus:border-[#2D63FF] text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
              </div>
              
              <div className="space-y-2 col-span-1 md:col-span-2 pt-2">
                <label className="text-xs text-gray-500">自提有效期限 (过期日23:00自动下架)</label>
                <div className="flex flex-wrap gap-3 items-center">
                  <button onClick={() => setFormData({...formData, expiryType: 'today'})} className={`px-4 py-2 rounded-lg text-sm transition-all border ${formData.expiryType === 'today' ? 'bg-[#2D63FF] text-white border-[#2D63FF]' : 'bg-white text-gray-600 border-gray-200'}`}>今天</button>
                  <button onClick={() => setFormData({...formData, expiryType: 'tomorrow'})} className={`px-4 py-2 rounded-lg text-sm transition-all border ${formData.expiryType === 'tomorrow' ? 'bg-[#2D63FF] text-white border-[#2D63FF]' : 'bg-white text-gray-600 border-gray-200'}`}>明天</button>
                  <button onClick={() => setFormData({...formData, expiryType: 'custom'})} className={`px-4 py-2 rounded-lg text-sm transition-all border ${formData.expiryType === 'custom' ? 'bg-[#2D63FF] text-white border-[#2D63FF]' : 'bg-white text-gray-600 border-gray-200'}`}>自选日期</button>
                  {formData.expiryType === 'custom' && (
                    <input type="date" className="px-4 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2D63FF] bg-gray-50" value={formData.customDate} onChange={e => setFormData({...formData, customDate: e.target.value})} min={new Date().toISOString().split('T')[0]} />
                  )}
                </div>
              </div>
            </div>
            <button onClick={handlePublish} disabled={loading} className="w-full bg-[#2D63FF] text-white py-4 rounded-xl font-bold text-lg active:scale-95 transition-all shadow-md">
              {loading ? '发布中...' : '立即发布'}
            </button>
          </div>
        </section>

        {/* 实时大厅 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="w-2 h-6 bg-[#E60012] rounded-full"></span>
                实时大厅
            </h2>
            {showOnlyMine && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-md animate-pulse">正在管理我的发布</span>}
          </div>

          {/* 搜索区 */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
                <select className="border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#2D63FF]" onChange={e=>setFilterType(e.target.value)}>
                    <option value="all">全部类型</option>
                    <option value="sell">仅看出售</option>
                    <option value="buy">仅看求购</option>
                </select>
                <input placeholder="🔍 搜门店" className="flex-[1.5] px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm focus:border-[#2D63FF]" value={searchStore} onChange={e => setSearchStore(e.target.value)} />
                <input placeholder="🔍 搜商品" className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 outline-none text-sm focus:border-[#2D63FF]" value={searchItem} onChange={e => setSearchItem(e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 min-h-[300px] p-2 shadow-sm">
            {isFetching ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-50 animate-pulse rounded-xl" />
                ))}
              </div>
            ) : displayPosts.length > 0 ? (
              <div className="space-y-2">
                {displayPosts.map(post => {
                  const isOwner = post.user_phone === phone && post.device_token === (typeof window !== 'undefined' ? localStorage.getItem('device_fingerprint') : null);

                  return (
                    <div key={post.id} className="relative p-5 border border-gray-50 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50/30 hover:bg-white transition-all group">
                      
                      {/* 修改a：增加过期时间显示 */}
                      <div className="absolute top-3 right-4 flex flex-col items-end gap-1">
                        <span className="text-[10px] text-gray-400">{formatTimeAgo(post.created_at)}</span>
                        <span className="text-[10px] font-medium text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded">
                          到期：{formatExpiry(post.expires_at)}
                        </span>
                      </div>

                      <div className="flex-1 flex gap-4 items-center w-full mt-6 sm:mt-0">
                        <div className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 ${post.type === 'sell' ? 'bg-red-50 text-[#E60012]' : 'bg-blue-50 text-[#2D63FF]'}`}>
                          {post.type === 'sell' ? 'SELL' : 'BUY'}
                        </div>
                        <div className="space-y-0.5 overflow-hidden">
                          <h4 className="font-bold text-gray-900 truncate pr-20">{post.shop}</h4>
                          <p className="text-xs text-gray-500 truncate">{post.item}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 w-full sm:w-auto justify-between shrink-0">
                        <span className="text-xl font-black text-[#E60012]">￥{post.price}</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => {
                            navigator.clipboard.writeText(post.contact); 
                            alert('微信号已复制');
                          }} className="bg-[#2D63FF] text-white px-5 py-2 rounded-lg text-sm font-bold shadow-sm">
                            复制微信
                          </button>
                          {isOwner && (
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
              <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                <p className="text-sm">暂无信息</p>
              </div>
            )}
          </div>
        </section>
      </main>
      
      <footer className="max-w-4xl mx-auto px-4 text-center text-[10px] text-gray-400">
          <p>© 2026 专注自提交流站 · 仅供玩家信息交流</p>
      </footer>
    </div>
  );
}
