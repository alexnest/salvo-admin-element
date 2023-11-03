import auth from '@/plugins/auth'
import router, { constantRoutes, dynamicRoutes } from '@/router'
import { getRouters } from '@/api/menu'
import Layout from '@/layout/index'
import ParentView from '@/components/ParentView'
import InnerLink from '@/layout/components/InnerLink'
import r from 'highlight.js/lib/languages/r'
import { LAYOUT, TYPE_DIR, ROOT_ID, INNER_LINK, PARENT_VIEW, NO_FRAME, TYPE_MENU } from '@/common/constant/userConstants.js'

const permission = {
  state: {
    routes: [],
    addRoutes: [],
    defaultRoutes: [],
    topbarRouters: [],
    sidebarRouters: []
  },
  mutations: {
    SET_ROUTES: (state, routes) => {
      state.addRoutes = routes
      state.routes = constantRoutes.concat(routes)
    },
    SET_DEFAULT_ROUTES: (state, routes) => {
      state.defaultRoutes = constantRoutes.concat(routes)
    },
    SET_TOPBAR_ROUTES: (state, routes) => {
      state.topbarRouters = routes
    },
    SET_SIDEBAR_ROUTERS: (state, routes) => {
      state.sidebarRouters = routes
    },
  },
  actions: {
    // 生成路由
    GenerateRoutes({ commit }) {
      return new Promise(resolve => {
        // 向后端请求路由数据
        getRouters().then(res => {
          const routers = transformRouters(res.data)
          console.log('routers', routers)
          const sdata = JSON.parse(JSON.stringify(routers))
          const rdata = JSON.parse(JSON.stringify(routers))
          const sidebarRoutes = filterAsyncRouter(sdata)
          const rewriteRoutes = filterAsyncRouter(rdata, false, true)
          const asyncRoutes = filterDynamicRoutes(dynamicRoutes);
          rewriteRoutes.push({ path: '*', redirect: '/404', hidden: true })
          router.addRoutes(asyncRoutes);
          commit('SET_ROUTES', rewriteRoutes)
          commit('SET_SIDEBAR_ROUTERS', constantRoutes.concat(sidebarRoutes))
          commit('SET_DEFAULT_ROUTES', sidebarRoutes)
          commit('SET_TOPBAR_ROUTES', sidebarRoutes)
          resolve(rewriteRoutes)
        })
      })
    }
  }
}

// transform response router to router which vue-router can use
// 把后端返回的路由转换成vue-router可以使用的路由格式
function transformRouters(menus) {
  let routers = []
  for (let i = 0; i < menus.length; i++) {
    let menu = menus[i]
    let router = {
      hidden: menu.visible === '1',
      name: getRouterName(menu),
      path: getRouterPath(menu),
      component: getComponent(menu),
      query: menu.query,
      meta: {
        title: menu.name,
        icon: menu.icon,
        noCache: menu.isCache ? false : true,
        link: ishttp(menu.path) ? menu.path : '',
      }
    }

    let cMenu = menu.children
    if (cMenu.length && TYPE_DIR === menu.type) {
      router.alwaysShow = true
      router.redirect = "noRedirect";
      router.children = transformRouters(cMenu)
    }
    else if (isMenuFrame(menu)) {
      router.meta = null;
      let children = [];
      let child = {}
      child.path = menu.path;
      child.component = menu.component;
      child.name = capitalize(menu.path);
      child.meta = {
        title: menu.name,
        icon: menu.icon,
        noCache: menu.isCache ? false : true,
        link: ishttp(menu.path) ? menu.path : '',
      }
      child.query = menu.query;
      children.push(child);
      router.children = children;
    }
    else if (menu.pid === ROOT_ID && isInnerLink(menu)) {
      router.meta = {
        title: menu.name,
        icon: menu.icon,
      }
      router.path = "/";
      let children = [];
      let child = {}
      child.path = innerLinkReplaceEach(menu.path);
      child.component = INNER_LINK;
      child.name = capitalize(menu.path);
      child.meta = {
        title: menu.name,
        icon: menu.icon,
        link: ishttp(menu.path) ? menu.path : '',
      }
      children.push(child);
      router.children = children;
    }

    routers.push(router)
  }
  return routers
}

/**
 * 获取组件信息
 * 
 * @param menu 菜单信息
 * @return 组件信息
 */
function getComponent(menu) {
  let component = LAYOUT;
  if (
    menu.component
    && isMenuFrame(menu)
  ) {
    component = menu.component;
  } else if (
    !menu.component
    && menu.pid !== ROOT_ID
    && isInnerLink(menu)
  ) {
    component = INNER_LINK;
  } else if (
    !menu.component
    && isParentView(menu)
  ) {
    component = PARENT_VIEW;
  }
  return component;
}

/**
 * 是否为parent_view组件
 * 
 * @param menu 菜单信息
 * @return 结果
 */
function isParentView(menu) {
  return menu.pid !== ROOT_ID && menu.type === TYPE_DIR;
}

// get router name
// 获取路由名称
function getRouterName(menu) {
  let routerName = capitalize(menu.name)
  // the menu is not link and it's the first level
  // 非外链并且是一级路由(类型为目录)
  if (isMenuLink(menu)) {
    routerName = ''
  }
  return routerName
}

// get router path
// 获取路由路径
function getRouterPath(menu) {
  if (!menu.path) return ''

  let routerPath = menu.path
  // 内链打开外网方式
  if (menu.pid !== '0' && isInnerLink(menu)) {
    routerPath = innerLinkReplaceEach(routerPath);
  }
  // 非外联并且是一级路由(类型为目录)
  if (
    menu.pid === ROOT_ID
    && menu.type === TYPE_DIR
    && menu.isFrame === NO_FRAME
  ) {
    routerPath = `/${menu.path}`
  }
  // 非外链并且是一级目录（类型为菜单）
  else if (isMenuFrame(menu)) {
    routerPath = "/";
  }
  return routerPath;
}

// 是否为菜单内部跳转
function isMenuFrame(menu) {
  return menu.pid === ROOT_ID
    && TYPE_MENU === menu.type
    && menu.isFrame === NO_FRAME;
}

// 是否为内链组件
function isInnerLink(menu) {
  return menu.isFrame === '1' && ishttp(menu.path)
}

// 判断路径是否是链接
function ishttp(path) {
  return path.startsWith('http://') || path.startsWith('https://')
}

// 内链域名特殊字符替换
function innerLinkReplaceEach(path) {
  return path.replace(/https/g, '').replace(/http/g, '').replace(/www/g, '').replace(/./g, '/')
}


// transform the word first letter to upper case
// 把单词的第一个字母转换成大写
function capitalize(word) {
  if (!word) return ''
  return word.charAt(0).toUpperCase() + word.slice(1)
}

// if redirect in the menu or not
// 是否为菜单内部跳转
function isMenuLink(menu) {
  if (
    menu.pid === '0'
    && menu.type === 'C'
    && menu.isFrame === '1'
  ) {
    return true
  }
  return false
}

// 遍历后台传来的路由字符串，转换为组件对象
function filterAsyncRouter(asyncRouterMap, lastRouter = false, type = false) {
  return asyncRouterMap.filter(route => {
    if (type && route.children) {
      route.children = filterChildren(route.children)
    }
    if (route.component) {
      // Layout ParentView 组件特殊处理
      if (route.component === 'Layout') {
        route.component = Layout
      } else if (route.component === 'ParentView') {
        route.component = ParentView
      } else if (route.component === 'InnerLink') {
        route.component = InnerLink
      } else {
        route.component = loadView(route.component)
      }
    }
    if (route.children != null && route.children && route.children.length) {
      route.children = filterAsyncRouter(route.children, route, type)
    } else {
      delete route['children']
      delete route['redirect']
    }
    return true
  })
}

function filterChildren(childrenMap, lastRouter = false) {
  var children = []
  childrenMap.forEach((el, index) => {
    if (el.children && el.children.length) {
      if (el.component === 'ParentView' && !lastRouter) {
        el.children.forEach(c => {
          c.path = el.path + '/' + c.path
          if (c.children && c.children.length) {
            children = children.concat(filterChildren(c.children, c))
            return
          }
          children.push(c)
        })
        return
      }
    }
    if (lastRouter) {
      el.path = lastRouter.path + '/' + el.path
    }
    children = children.concat(el)
  })
  return children
}

// 动态路由遍历，验证是否具备权限
export function filterDynamicRoutes(routes) {
  const res = []
  routes.forEach(route => {
    if (route.permissions) {
      if (auth.hasPermiOr(route.permissions)) {
        res.push(route)
      }
    } else if (route.roles) {
      if (auth.hasRoleOr(route.roles)) {
        res.push(route)
      }
    }
  })
  return res
}

export const loadView = (view) => {
  if (process.env.NODE_ENV === 'development') {
    return (resolve) => require([`@/views/${view}`], resolve)
  } else {
    // 使用 import 实现生产环境的路由懒加载
    return () => import(`@/views/${view}`)
  }
}

export default permission
