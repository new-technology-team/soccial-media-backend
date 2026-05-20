'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'

export default function ReportPage() {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.accessToken)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formData, setFormData] = useState({
    reportType: '',
    targetType: '',
    targetId: '',
    reason: '',
    details: '',
    evidence: '',
  })

  const reportTypes = [
    { value: 'harassment', label: 'QuĂ¡º¥y rĂ¡»‘i hoặc bĂ¡º¯t nạt' },
    { value: 'hate_speech', label: 'NĂ¡»™i dung thù hĂ¡º­n' },
    { value: 'misinformation', label: 'Thông tin sai lĂ¡»‡ch' },
    { value: 'spam', label: 'Spam' },
    { value: 'explicit', label: 'NĂ¡»™i dung nhạy cĂ¡º£m' },
    { value: 'copyright', label: 'Vi phạm bĂ¡º£n quyĂ¡»n' },
    { value: 'impersonation', label: 'Mạo danh' },
    { value: 'other', label: 'Khác' },
  ]

  const handleChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (!token) {
        throw new Error('Bạn cần đăng nhĂ¡º­p để gĂ¡» i báo cáo')
      }

      await api.submitReport(token, {
        targetType: formData.targetType as 'post' | 'comment' | 'user' | 'message',
        targetId: Number(formData.targetId),
        reason: formData.reportType,
        details: `${formData.reason}\n${formData.details}\n${formData.evidence}`.trim(),
      })

        setSubmitted(true)
        setTimeout(() => navigate('/feed'), 3000)
    } catch (error) {
      console.error('Failed to submit report:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="app-page flex items-center justify-center">
        <Card className="border-0 shadow-sm max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Da gui bao cao</h2>
            <p className="text-muted-foreground mb-6">
              CĂ¡º£m ơn bạn đã đóng góp để giĂ¡»¯ môi trưĂ¡»ng cĂ¡»™ng đĂ¡»“ng an toàn. ĐĂ¡»™i ngũ kiĂ¡»ƒm duyĂ¡»‡t sẽ xĂ¡»  lý sĂ¡»›m.
            </p>
            <Button onClick={() => navigate('/feed')} className="w-full">
              Quay lại bĂ¡º£ng tin
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="app-page">
      <div className="app-container">
        <div className="max-w-2xl mx-auto">
        <div className="app-header">
          <h1 className="app-title">Báo cáo nĂ¡»™i dung</h1>
          <p className="app-subtitle">Giúp hĂ¡»‡ thống duy trì cĂ¡»™ng đĂ¡»“ng an toàn bằng cách gĂ¡» i thông tin vi phạm.</p>
        </div>

        <Alert className="mb-6 border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            Vui lòng cung cĂ¡º¥p thông tin chi tiĂ¡º¿t để đĂ¡»™i ngũ kiĂ¡»ƒm duyĂ¡»‡t xĂ¡»  lý nhanh hơn.
          </AlertDescription>
        </Alert>

        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Report Type */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Bạn đang báo cáo loại nào?</Label>
                <Select value={formData.reportType} onValueChange={(value) => handleChange('reportType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="ChĂ¡»n loại báo cáo" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Target Type */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">ĐĂ¡»‘i tưĂ¡»£ng bĂ¡»‹ báo cáo</Label>
                <RadioGroup value={formData.targetType} onValueChange={(value) => handleChange('targetType', value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="post" id="post" />
                    <Label htmlFor="post" className="font-normal cursor-pointer">Bài viĂ¡º¿t</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="comment" id="comment" />
                    <Label htmlFor="comment" className="font-normal cursor-pointer">Bình luĂ¡º­n</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="user" id="user" />
                    <Label htmlFor="user" className="font-normal cursor-pointer">Tài khoĂ¡º£n ngưĂ¡»i dùng</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="message" id="message" />
                    <Label htmlFor="message" className="font-normal cursor-pointer">Tin nhĂ¡º¯n trĂ¡»±c tiĂ¡º¿p</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Target ID */}
              <div className="space-y-2">
                <Label htmlFor="targetId">ID đĂ¡»‘i tưĂ¡»£ng</Label>
                <Input
                  id="targetId"
                  placeholder={`NhĂ¡º­p ID ${formData.targetType || 'nĂ¡»™i dung'}`}
                  value={formData.targetId}
                  onChange={(e) => handleChange('targetId', e.target.value)}
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">Lý do cĂ¡»¥ thĂ¡»ƒ</Label>
                <Textarea
                  id="reason"
                  placeholder="Mô tĂ¡º£ hành vi vi phạm tiêu chuẩn cĂ¡»™ng đĂ¡»“ng..."
                  value={formData.reason}
                  onChange={(e) => handleChange('reason', e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[100px]"
                  required
                />
              </div>

              {/* Details */}
              <div className="space-y-2">
                <Label htmlFor="details">Thông tin bĂ¡»• sung</Label>
                <Textarea
                  id="details"
                  placeholder="BĂ¡»• sung bĂ¡»‘i cĂ¡º£nh hoặc thông tin liên quan..."
                  value={formData.details}
                  onChange={(e) => handleChange('details', e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[100px]"
                />
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <Label htmlFor="evidence">Bằng chĂ¡»©ng/Ă¡º£nh chĂ¡»¥p màn hình</Label>
                <Textarea
                  id="evidence"
                  placeholder="Mô tĂ¡º£ bằng chĂ¡»©ng giúp xác minh báo cáo..."
                  value={formData.evidence}
                  onChange={(e) => handleChange('evidence', e.target.value)}
                  disabled={isSubmitting}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" required disabled={isSubmitting} />
                  Tôi xác nhĂ¡º­n thông tin cung cĂ¡º¥p là đúng sĂ¡»± thĂ¡º­t.
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={!formData.reportType || !formData.targetType || !formData.targetId || !formData.reason || isSubmitting}
              >
                {isSubmitting ? 'Ä ang gĂ¡» i...' : 'GĂ¡»­i báo cáo'}
              </Button>
            </form>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}

