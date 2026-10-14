from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.static import serve

import coins.urls as coins_urls

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('frontend.urls')),
    # Coin tizimi (admin/o'qituvchi)
    path('api/employee/', include(coins_urls.admin_urlpatterns)),
    # Coin tizimi (o'quvchi)
    path('api/student/', include(coins_urls.student_urlpatterns)),
]

handler403 = "frontend.views.permission_denied"

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT})]
