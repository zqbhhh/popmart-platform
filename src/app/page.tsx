"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase 连接
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PopmartMarket() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 搜索与筛选状态
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); 
  const [sortOrder, setSortOrder] = useState('desc'); 

  // 表单状态
  const [formData, setFormData] = useState({ 
    price: '', shop: '', item: '', contact: '', 
    expiryType: 'today', customDate: '' 
  });

  // 获取数据库数据
  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        const now = new Date();
        // 过滤掉已过期的信息
        const validPosts = data.filter(post => !post.expires_at || new Date(post.expires_at) > now);
        setPosts(validPosts);
      }
      if (error) console.error("读取失败:", error.message);
    } catch (err) {
      console.error("连接异常:", err);
    }
  };

  useEffect(() => {
    if (isLoggedIn && hasAgreed) {
      fetchPosts();
      const channel = supabase.channel('realtime_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          fetchPosts();
        }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, hasAgreed]);

  // 计算过期时间
  const getExpiryDate = () => {
    const d = new Date();
    if (formData.expiryType === 'today') {
      d.setHours(23, 59, 59, 999);
    } else if (formData.expiryType === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 999);
    } else if (formData.customDate) {
      return new Date(formData.customDate + "T23:59:59");
    }
    return d;
  };

  // 发布函数
  const handlePublish = async (type: 'sell' | 'buy') => {
    if (!formData.price || !formData.item || !formData.contact) return alert('请填写完整信息');
    setLoading(true);
    
    const { error } = await supabase.from('posts').insert([{ 
      ...formData, 
      type, 
      user_phone: phone,
      expires_at: getExpiryDate().toISOString(),
      price: parseFloat(formData.price) 
    }]);

    if (error) {
      alert('发布失败: ' + error.message);
    } else {
      alert('🎉 发布成功！');
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
    }
    setLoading(false);
  };

  // 删除函数
  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这条信息吗？')) {
      await supabase.from('posts').delete().eq('id', id);
      fetchPosts();
    }
  };

  // 综合过滤与排序逻辑
  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => (p.shop.includes(searchTerm) || p.item.includes(searchTerm)))
    .sort((a, b) => sortOrder === 'desc' ? b.price - a.price : a.price - b.price);

  // --- 1. 免责声明弹窗 ---
  if (isLoggedIn && !hasAgreed) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-md">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
          <h2 className="text-2xl font-black mb-6 text-center text-red-500 underline decoration-yellow-400">自提交流站须知</h2>
          <div className="text-[13px] text-gray-700 space-y-4 leading-relaxed overflow-y-auto max-h-[60vh] pr-2">
            <p><strong>1. 信息中转：</strong>本平台仅提供信息发布，不提供担保及支付服务。</p>
            <p><strong>2. 风险自担：</strong>请核实对方身份，保留聊天和支付凭证。</p>
            <p><strong>3. 严禁违规：</strong>严禁发布虚假信息，违者永久封禁微信号。</p>
            <p><strong>4. 责任豁免：</strong>平台不对交易产生的任何损失负责。</p>
            <p><strong>5. 内容声明：</strong>用户言论不代表本站立场。</p>
            <p><strong>6. 隐私保护：</strong>微信号仅在被点击“复制”时显示并计费。</p>
          </div>
          <button 
            onClick={() => setHasAgreed(true)} 
            className="w-full bg-red-500 text-white py-4 rounded-2xl mt-8 font-black shadow-xl active:scale-95 transition-all"
          >阅读并同意协议</button>
        </div>
      </div>
    );
  }

  // --- 2. 登录页 ---
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDFDFD]">
        <div className="p-10 w-full max-w-sm text-center">
          <div className="text-5xl mb-6 animate-bounce">📦</div>
          <h1 className="text-3xl font-black text-black mb-2 tracking-tighter">POPMART</h1>
          <p className="text-gray-400 text-xs mb-10 tracking-[0.3em] font-bold">专注自提交流</p>
          <input 
            type="text" placeholder="输入11位手机号" 
            className="w-full p-4 bg-gray-100 border-none rounded-2xl mb-4 text-center text-black font-bold outline-none"
            value={phone} onChange={e => setPhone(e.target.value)}
          />
          <button 
            onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('手机号不对')} 
            className="w-full bg-black text-white py-4 rounded-2xl font-black hover:opacity-80 transition-all"
          >进入大厅</button>
        </div>
      </div>
    );
  }

  // --- 3. 主大厅界面 ---
  return (
    <div className="min-h-screen bg-[#F7F7F7] pb-24 text-black">
      {/* 滚动横幅 - 使用标准 CSS 避免报错 */}
      <div className="bg-yellow-400 text-red-700 py-2 font-bold text-xs shadow-sm overflow-hidden sticky top-0 z-40">
        <div className="whitespace-nowrap animate-[scroll_30s_linear_infinite] inline-block">
          ⚠️ 已出售，已求购完，请自行删除发布信息，以防骚扰！ | 温馨提示：请在加好友后，自觉互传交易记录，谨慎交易 | 联系邮箱：zqbzqb888@outlook.com &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
          ⚠️ 已出售，已求购完，请自行删除发布信息，以防骚扰！ | 温馨提示：请在加好友后，自觉互传交易记录，谨慎交易 | 联系邮箱：zqbzqb888@outlook.com
        </div>
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <main className="max-w-4xl mx-auto p-4">
        {/* 发布表单 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
          {/* 出售 */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="font-black text-red-500 mb-6 flex items-center gap-2">🔴 发布出售自提</h3>
            <div className="space-y-4">
              <input type="number" placeholder="标价 (元)" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
              <input placeholder="门店全名" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              <input placeholder="商品全名" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              <input placeholder="个人微信号" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
              <div className="flex items-center text-[10px] text-gray-400 font-bold px-1">
                到期时间:
                <select className="ml-2 bg-transparent text-gray-600 outline-none" value={formData.expiryType} onChange={e=>setFormData({...formData, expiryType:e.target.value})}>
                  <option value="today">今天 (23:59)</option>
                  <option value="tomorrow">明天 (23:59)</option>
                  <option value="custom">自选日期</option>
                </select>
                {formData.expiryType === 'custom' && <input type="date" className="ml-2" onChange={e=>setFormData({...formData, customDate:e.target.value})} />}
              </div>
              <button onClick={()=>handlePublish('sell')} className="w-full bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-100 active:scale-95 transition-all">立即发布</button>
            </div>
          </div>
          
          {/* 求购 */}
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100">
            <h3 className="font-black text-blue-500 mb-6 flex items-center gap-2">🔵 发布求购信息</h3>
            <div className="space-y-4">
              <input type="number" placeholder="求购价格 (元)" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
              <input placeholder="目标门店" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
              <input placeholder="求购商品" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
              <input placeholder="个人微信号" className="w-full p-3 bg-gray-50 rounded-2xl border-none font-bold" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
              <button onClick={()=>handlePublish('buy')} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-100 active:scale-95 transition-all">发布求购</button>
            </div>
          </div>
        </div>

        {/* 筛选大厅 */}
        <div className="bg-white p-5 rounded-3xl shadow-sm mb-8 flex flex-col sm:flex-row gap-4">
          <input 
            placeholder="🔍 搜索门店或商品名称..." 
            className="flex-1 p-3 bg-gray-50 rounded-2xl border-none font-bold outline-none"
            onChange={e => setSearchTerm(e.target.value)}
          />
          <div className="flex gap-2">
            <select className="bg-gray-50 p-3 rounded-2xl border-none font-bold text-sm" onChange={e=>setFilterType(e.target.value)}>
              <option value="all">全部</option>
              <option value="sell">出售</option>
              <option value="buy">求购</option>
            </select>
            <select className="bg-gray-50 p-3 rounded-2xl border-none font-bold text-sm" onChange={e=>setSortOrder(e.target.value)}>
              <option value="desc">价格↓</option>
              <option value="asc">价格↑</option>
            </select>
          </div>
        </div>

        {/* 列表渲染 */}
        <div className="space-y-4">
          {displayPosts.map(post => (
            <div key={post.id} className="bg-white p-5 rounded-[2rem] shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center border border-transparent hover:border-gray-200 transition-all gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black text-white ${post.type === 'sell' ? 'bg-red-500' : 'bg-blue-500'}`}>
                    {post.type === 'sell' ? 'SELL' : 'BUY'}
                  </span>
                  <span className="text-2xl font-black">￥{post.price}</span>
                </div>
                <h4 className="font-black text-lg">{post.shop}</h4>
                <p className="text-gray-500 font-bold text-sm">{post.item}</p>
                <p className="text-[9px] text-gray-300 font-bold mt-2">到期: {new Date(post.expires_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button 
                  onClick={() => {navigator.clipboard.writeText(post.contact); alert('微信已复制！')}}
                  className="flex-1 sm:flex-none bg-black text-white px-8 py-3 rounded-2xl text-xs font-black active:scale-90 transition-all"
                >复制微信</button>
                {post.user_phone === phone && (
                  <button onClick={() => handleDelete(post.id)} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}